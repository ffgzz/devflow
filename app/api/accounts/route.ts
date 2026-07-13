import Account from "@/database/account.model";
import { requireAuthenticatedUserId } from "@/lib/auth/authorization";
import { toAccountDTO } from "@/lib/dal/dto";
import handleError from "@/lib/handlers/error";
import { dbConnect } from "@/lib/mongoose";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const viewerId = await requireAuthenticatedUserId();
    await dbConnect();

    const accounts = await Account.find({ userId: viewerId })
      .select("name image provider")
      .lean();

    return NextResponse.json(
      { success: true, data: accounts.map(toAccountDTO) },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}

// Account creation is only allowed inside the trusted credentials/OAuth flows.
// Deliberately omitting POST prevents callers from forging provider links.
