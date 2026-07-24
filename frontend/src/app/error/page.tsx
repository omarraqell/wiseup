export default function ErrorPage() {
  return (
    <div className="max-w-md mx-auto py-24 px-6 text-center">
      <h1 className="font-[Oswald] text-2xl text-brand-red mb-4">
        Something went wrong
      </h1>
      <p className="text-[#5e3f3b]">
        This link may have expired or already been used. Try signing up or
        resetting your password again.
      </p>
    </div>
  );
}
