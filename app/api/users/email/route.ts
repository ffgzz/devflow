import User from "@/database/user.model";
import { requireAuthenticatedUserId } from "@/lib/auth/authorization";
import handleError from "@/lib/handlers/error";
import { ValidationError } from "@/lib/http-errors";
import { dbConnect } from "@/lib/mongoose";
import { UserSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

const EmailLookupSchema = UserSchema.pick({ email: true }).strict();

export async function POST(request: Request) {
  try {
    const viewerId = await requireAuthenticatedUserId();
    const validated = EmailLookupSchema.safeParse(await request.json());

    if (!validated.success) {
      throw new ValidationError(validated.error.flatten().fieldErrors);
    }

    await dbConnect();
    const exists = Boolean(
      await User.exists({
        _id: viewerId,
        email: validated.data.email.trim().toLowerCase(),
      }),
    );

    // This endpoint only confirms the current user's own email and cannot be
    // used to enumerate registered addresses.
    return NextResponse.json({ success: true, data: { exists } });
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}
