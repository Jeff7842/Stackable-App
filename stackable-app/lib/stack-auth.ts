import "server-only";
import { StackServerApp } from "@stackframe/stack";

export const stackAuth = new StackServerApp({
    tokenStore: "nextjs-cookie",
    
  //secret: process.env.STACK_SECRET_SERVER_KEY!,
  projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY,

  /*urls: {
    signIn: "/handler/sign-in",
    signUp: "/handler/sign-up",
    afterSignIn: "/dashboard",
    afterSignUp: "/dashboard",
    afterSignOut: "/handler/sign-in",
    home: "/dashboard",
  },
  */
  
});

console.log("STACK AUTH PROJECT:", stackAuth);