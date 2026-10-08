import CourseCatalog from '../components/CourseCatalog.tsx'

/** Full catalog page at /openings. */
export default function Openings() {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Openings</h1>
      <CourseCatalog />
    </main>
  )
}
