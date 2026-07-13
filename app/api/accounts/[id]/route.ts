import Account from "@/database/account.model";
import { requireAuthenticatedUserId } from "@/lib/auth/authorization";
import { toAccountDTO } from "@/lib/dal/dto";
import handleError from "@/lib/handlers/error";
import { NotFoundError, ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { AccountSchema } from "@/lib/validations";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const AccountUpdateSchema = AccountSchema.pick({ name: true, image: true })
  .partial()
  .strict();

type AccountRouteContext = { params: Promise<{ id: string }> };

function validateId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Account");
}

export async function GET(_: Request, { params }: AccountRouteContext) {
  try {
    const { id } = await params;
    validateId(id);
    const viewerId = await requireAuthenticatedUserId();
    await dbConnect();

    const account = await Account.findOne({ _id: id, userId: viewerId })
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

export async function DELETE(_: Request, { params }: AccountRouteContext) {
  try {
    const { id } = await params;
    validateId(id);
    const viewerId = await requireAuthenticatedUserId();
    await dbConnect();

    const account = await Account.findOneAndDelete({
      _id: id,
      userId: viewerId,
    });
    if (!account) throw new NotFoundError("Account");

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}

export async function PUT(
  request: Request,
  { params }: AccountRouteContext,
) {
  try {
    const { id } = await params;
    validateId(id);
    const viewerId = await requireAuthenticatedUserId();
    const validated = AccountUpdateSchema.safeParse(await request.json());

    if (!validated.success) {
      throw new ValidationError(validated.error.flatten().fieldErrors);
    }

    await dbConnect();
    const updatedAccount = await Account.findOneAndUpdate(
      { _id: id, userId: viewerId },
      { $set: validated.data },
      { new: true, runValidators: true },
    ).select("name image provider");
    if (!updatedAccount) throw new NotFoundError("Account");

    return NextResponse.json(
      { success: true, data: toAccountDTO(updatedAccount) },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}
