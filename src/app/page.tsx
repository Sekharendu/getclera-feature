const steps = [
  {
    number: "01",
    title: "Define the role",
    description: "Review skills, salary, work policy, location, and availability requirements.",
  },
  {
    number: "02",
    title: "Understand mutual fit",
    description: "See employer requirements and candidate preferences alongside their source evidence.",
  },
  {
    number: "03",
    title: "Explore a change",
    description: "Compare a scenario with the confirmed baseline to understand what changes the shortlist.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dce2db] py-7">
        <p className="text-sm font-semibold tracking-tight">Clera / Match Explorer</p>
        <span className="rounded-full border border-[#dce2db] bg-white px-3 py-1 text-xs text-[#526158]">
          Independent prototype
        </span>
      </header>

      <main id="main-content" className="flex-1 py-16 sm:py-24">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#526158]">
          A clearer view of mutual fit
        </p>
        <h1 className="max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-6xl">
          Understand what shapes your shortlist.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526158]">
          Explore how a role fits a candidate, how a candidate fits a role, and
          which requirements make the difference.
        </p>

        <section aria-labelledby="status-heading" className="mt-10 rounded-2xl border border-[#dce2db] bg-white p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#42634c]">In development</p>
          <h2 id="status-heading" className="mt-3 text-xl font-semibold">The foundation is in place.</h2>
          <p className="mt-3 max-w-2xl leading-7 text-[#526158]">
            This is the initial application shell. Fictional profiles, matching,
            and scenario controls will arrive in the next development stages.
          </p>
        </section>

        <section aria-labelledby="workflow-heading" className="mt-14">
          <h2 id="workflow-heading" className="text-sm font-semibold">The planned workflow</h2>
          <ol className="mt-6 grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.number} className="border-t border-[#dce2db] pt-5">
                <span className="text-xs text-[#526158]">{step.number}</span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526158]">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="border-t border-[#dce2db] py-6 text-xs leading-6 text-[#526158]">
        An independent portfolio project. Not affiliated with Clera. Planned demos use fictional profiles.
      </footer>
    </div>
  );
}
