import type { Transaction } from "@electric-sql/pglite";
import { invariant, microUsd } from "@/domain/platform";
import { newId } from "./crypto";

/** Simulated credits only. No payment processor or real funds. */
export class Ledger {
  async reserve(
    tx: Transaction,
    organizationId: string,
    jobId: string,
    amount: number,
  ) {
    microUsd(amount);
    const account = await tx.query<{ available: number; reserved: number }>(
      "select available::float8,reserved::float8 from credit_accounts where organization_id=$1 for update",
      [organizationId],
    );
    invariant(
      account.rows[0] && account.rows[0].available >= amount,
      "INSUFFICIENT_SIMULATED_CREDITS",
      402,
    );
    await tx.query(
      "update credit_accounts set available=available-$2,reserved=reserved+$2 where organization_id=$1",
      [organizationId, amount],
    );
    await tx.query(
      "insert into credit_reservations values($1,$2,$3,$4,null,'reserved')",
      [organizationId, newId(), jobId, amount],
    );
    await tx.query(
      "insert into cost_ledger(organization_id,id,idempotency_key,kind,amount,body) values($1,$2,$3,'reserve',$4,$5)",
      [
        organizationId,
        newId(),
        "reserve:" + jobId,
        amount,
        JSON.stringify({ jobId, simulated: true, externalSpendMicroUsd: 0 }),
      ],
    );
  }
  async settle(
    tx: Transaction,
    organizationId: string,
    jobId: string,
    actual: number | null,
  ) {
    const result = await tx.query<{
      id: string;
      amount: number;
      status: string;
    }>(
      "select id,amount::float8,status from credit_reservations where organization_id=$1 and job_id=$2 for update",
      [organizationId, jobId],
    );
    const r = result.rows[0];
    invariant(r, "RESERVATION_NOT_FOUND", 409);
    if (r.status !== "reserved") return;
    const value = actual === null ? 0 : microUsd(actual);
    invariant(value <= r.amount, "COST_EXCEEDS_RESERVATION", 409);
    await tx.query(
      "update credit_accounts set available=available+$2-$3,reserved=reserved-$2 where organization_id=$1",
      [organizationId, r.amount, value],
    );
    await tx.query(
      "update credit_reservations set actual=$3,status=$4 where organization_id=$1 and id=$2",
      [organizationId, r.id, value, actual === null ? "released" : "captured"],
    );
    await tx.query(
      "insert into cost_ledger(organization_id,id,idempotency_key,kind,amount,body) values($1,$2,$3,$4,$5,$6)",
      [
        organizationId,
        newId(),
        "settle:" + jobId,
        actual === null ? "release" : "capture",
        value,
        JSON.stringify({ jobId, simulated: true, externalSpendMicroUsd: 0 }),
      ],
    );
  }
}
