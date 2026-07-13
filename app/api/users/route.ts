import User from "@/database/user.model";
import { toUserSummaryDTO } from "@/lib/dal/dto";
import handleError from "@/lib/handlers/error";
import { dbConnect } from "@/lib/mongoose";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await dbConnect();
    const users = await User.find()
      .select("name username image reputation")
      .sort({ reputation: -1, _id: 1 })
      .limit(50)
      .lean();

    return NextResponse.json(
      { success: true, data: users.map(toUserSummaryDTO) },
      { status: 200 },
    );
  } catch (error) {
    return handleError(error, "api") as APIErrorResponse;
  }
}

// User creation belongs to the validated credentials/OAuth flows. Deliberately
// omitting POST makes direct unauthenticated creation return 405.
