const ROUTES = {
  HOME: "/",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  PROFILE: (id: string) => `/profile/${id}`,
  QUESTION: (id: string) => `/questions/${id}`,
  TAGS: (id: string) => `/tags/${id}`,
  ASK_QUESTION: "/ask-question",
  SIGN_IN_WITH_OAUTH: "/auth/signin-with-oauth",
};

export default ROUTES;
