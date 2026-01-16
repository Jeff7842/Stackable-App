import { StackAuth } from "@stack-auth/next/server";

export const stackAuth = new StackAuth({
  secret: process.env.STACK_AUTH_SECRET!,
  projectId: process.env.STACK_AUTH_PROJECT_ID!,
});
