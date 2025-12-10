import { UploadForm } from "@/components/residuals/upload/UploadForm"

export default function UploadPage() {
  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground mt-2">
          Upload monthly residual reports from payment processors. The system will automatically detect duplicates and
          prepare events for assignment.
        </p>
      </div>

      <UploadForm />
    </div>
  )
}
