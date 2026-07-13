import ROUTES from "./routes";

export const DEFAULT_EMPTY = {
  title: "No Data Found",
  message:
    "Looks like the database is taking a nap. Wake it up by adding some data!",
  button: {
    text: "Add Data",
    href: ROUTES.HOME,
  },
};

export const DEFAULT_ERROR = {
  title: "Something Went Wrong",
  message:
    "Even our code can have a bad day. Don't worry, we're on it! Try refreshing the page or come back later.",
  button: {
    text: "Try Again",
    href: ROUTES.HOME,
  },
};

export const EMPTY_QUESTION = {
  title: "No Questions Yet",
  message:
    "It seems like there are no questions in the database. Be the first one to ask a question and start the discussion!",
};

export const EMPTY_TAGS = {
  title: "No Tags Found",
  message: "The tag cloud is empty. Add some keywords to make it rain.",
  button: {
    text: "Create Tag",
    href: ROUTES.TAGS,
  },
};

export const EMPTY_ANSWERS = {
  title: "No Answers Found",
  message:
    "The answer board is empty. Make it rain with your brilliant answer.",
};

export const EMPTY_COLLECTIONS = {
  title: "Collections Are Empty",
  message:
    "Looks like you haven’t created any collections yet. Start curating something extraordinary today",
  button: {
    text: "Save to Collection",
    href: ROUTES.COLLECTION,
  },
};

export const EMPTY_USERS = {
  title: "No Users Found",
  message: "You're ALONE. The only one here. More uses are coming soon!",
};

export const EMPTY_NOTIFICATIONS = {
  title: "You're All Caught Up",
  message: "New answers and accepted answers will appear here.",
};
