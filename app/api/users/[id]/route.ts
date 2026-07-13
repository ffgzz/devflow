import User from "@/database/user.model";
import {
  requireAuthenticatedUserId,
  requireSelf,
} from "@/lib/auth/authorization";
import { toUserProfileDTO } from "@/lib/dal/dto";
import handleError from "@/lib/handlers/error";
import { NotFoundError, ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { UserSchema } from "@/lib/validations";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const UserUpdateSchema = UserSchema.pick({
  name: true,
  username: true,
  bio: true,
  image: true,
  location: true,
  portfolio: true,
})
  .partial()
  .strict();

type UserRouteContext = { params: Promise<{ id: string }> };

function validateId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("User");
}

export async function GET(_: Request, { params }: UserRouteContext) {
  try {
    const { id } = await params;
    validateId(id);
    await dbConnect();

    const user = await User.findById(id)
      .select(
        "name username bio image location portfolio reputation createdAt",
      )
      .lean();
    if (!user) throw new NotFoundError("User");

    return NextResponse.json(
      { success: true, data: toUserProfileDTO(user) },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}

export async function PUT(request: Request, { params }: UserRouteContext) {
  try {
    const { id } = await params;
    validateId(id);
    const viewerId = await requireAuthenticatedUserId();
    requireSelf(viewerId, id);

    const validated = UserUpdateSchema.safeParse(await request.json());
    if (!validated.success) {
      throw new ValidationError(validated.error.flatten().fieldErrors);
    }

    await dbConnect();
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: validated.data },
      { new: true, runValidators: true },
    ).select(
      "name username bio image location portfolio reputation createdAt",
    );
    if (!updatedUser) throw new NotFoundError("User");

    return NextResponse.json(
      { success: true, data: toUserProfileDTO(updatedUser) },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}
