import Account from "@/database/account.model";
import { requireAuthenticatedUserId } from "@/lib/auth/authorization";
import { toAccountDTO } from "@/lib/dal/dto";
import handleError from "@/lib/handlers/error";
import { NotFoundError, ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { AccountSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

const ProviderLookupSchema = AccountSchema.pick({
  providerAccountId: true,
}).strict();

export async function POST(request: Request) {
  try {
    const viewerId = await requireAuthenticatedUserId();
    const validated = ProviderLookupSchema.safeParse(await request.json());

    if (!validated.success) {
      throw new ValidationError(validated.error.flatten().fieldErrors);
    }

    await dbConnect();
    const account = await Account.findOne({
      userId: viewerId,
      providerAccountId: validated.data.providerAccountId,
    })
      .select("name image provider")
      .lean();
    if (!account) throw new NotFoundError("Account");

    return NextResponse.json(
      { success: true, data: toAccountDTO(account) },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}
