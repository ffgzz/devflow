const ROUTES = {
  HOME: "/",
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
  PROFILE: (id: string) => `/profile/${id}`,
  QUESTION: (id: string) => `/questions/${id}`,
  TAG: (id: string) => `/tags/${id}`,
  ASK_QUESTION: "/ask-question",
  COLLECTION: "/collection",
  NOTIFICATIONS: "/notifications",
  COMMUNITY: "/community",
  TAGS: "/tags",
  JOBS: "/jobs",
  PLAYGROUND: "/playground",
  SIGN_IN_WITH_OAUTH: "/auth/signin-with-oauth",
};

export default ROUTES;
