import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <SignUp />
    </div>
  );
}
