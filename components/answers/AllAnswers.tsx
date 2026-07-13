import { AnswerFilters } from "@/constants/filters";
import { EMPTY_ANSWERS } from "@/constants/states";
import DataRenderer from "../DataRenderer";
import CommonFilter from "../filters/CommonFilter";
import Pagination from "../Pagination";
import { AnswerAcceptanceProvider } from "./AnswerAcceptanceControl";
import AnswerCard from "./AnswerCard";

interface Props extends ActionResponse<Answer[]> {
  totalAnswers: number;
  page: number;
  isNext: boolean;
  questionId: string;
  acceptedAnswerId: string | null;
  canManageAcceptance: boolean;
}

const AllAnswers = ({
  data,
  page,
  isNext,
  success,
  errors,
  totalAnswers,
  questionId,
  acceptedAnswerId,
  canManageAcceptance,
}: Props) => {
  return (
    <div className="mt-11">
      <div className="flex items-center justify-between">
        <h3 className="primary-text-gradient">
          {totalAnswers} {totalAnswers === 1 ? "Answer" : "Answers"}
        </h3>
        {/* 筛选排序 */}
        <CommonFilter
          filters={AnswerFilters}
          otherClasses="sm:min-w-[30px]"
          containerClasses="max-xs:w-full"
        />
      </div>

      <DataRenderer
        data={data}
        success={success}
        error={errors}
        empty={EMPTY_ANSWERS}
        render={(answers) =>
          <AnswerAcceptanceProvider
            key={questionId}
            questionId={questionId}
            initialAcceptedAnswerId={acceptedAnswerId}
            canManageAcceptance={canManageAcceptance}
          >
            {answers.map((answer) => (
              <AnswerCard key={answer._id} {...answer} />
            ))}
          </AnswerAcceptanceProvider>
        }
      />

      <Pagination page={page} isNext={isNext} resetKeys={["answer"]} />
    </div>
  );
};

export default AllAnswers;
