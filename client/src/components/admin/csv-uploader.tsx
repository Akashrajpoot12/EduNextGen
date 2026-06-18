"use client"

import { useState } from "react"
import Papa from "papaparse"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useTenant } from "@/components/layout/DashboardLayout"
import { toast } from "sonner"

// Zod validation schema for student rows
const studentRowSchema = z.object({
  first_name: z.string().min(1, "First Name is required"),
  last_name: z.string().optional().default(""),
  enrollment_number: z.string().min(1, "Enrollment/Admission number is required"),
})

export function CsvUploader() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<{ success: number; errors: number } | null>(null)
  
  const supabase = createClient()
  const { tenantId } = useTenant()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    setResults(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parseResults) => {
        const rows = parseResults.data as any[]
        
        const cleanPayload: any[] = []
        let errorCount = 0

        rows.forEach((row, index) => {
          // Normalize headers
          const rawRow = {
            first_name: row.first_name || row.FirstName || row.Firstname || row.name || "",
            last_name: row.last_name || row.LastName || row.Lastname || "",
            enrollment_number: row.enrollment_number || row.RollNo || row.AdmissionNo || row.enrollment || "",
          }

          const validation = studentRowSchema.safeParse(rawRow)
          if (validation.success) {
            cleanPayload.push({
              school_id: tenantId,
              first_name: validation.data.first_name,
              last_name: validation.data.last_name,
              enrollment_number: validation.data.enrollment_number,
            })
          } else {
            errorCount++
            console.warn(`CSV Row ${index + 1} validation failed:`, validation.error.format())
          }
        })

        if (cleanPayload.length > 0) {
          const toastId = toast.loading(`Uploading ${cleanPayload.length} students to database...`)
          try {
            const { error } = await supabase.from('students').insert(cleanPayload)
            if (error) throw error;
            
            toast.success(`Successfully enrolled ${cleanPayload.length} students!`, { id: toastId })
            setResults({ success: cleanPayload.length, errors: errorCount })
          } catch (err: any) {
            console.error("Bulk insert failed:", err)
            toast.error("Database sync failed: " + err.message, { id: toastId })
            setResults({ success: 0, errors: errorCount + cleanPayload.length })
          }
        } else {
          toast.error("No valid student records found in the CSV.")
          setResults({ success: 0, errors: errorCount })
        }
        
        setIsUploading(false)
      },
      error: (err) => {
        console.error("CSV Parse Error:", err)
        toast.error("Failed to parse CSV file.")
        setIsUploading(false)
      }
    })
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Bulk Student Migration</CardTitle>
        <CardDescription>Upload a CSV file containing student records to instantly enroll them into the system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-2">
          <Input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <p className="text-xs text-muted-foreground">Required columns: First Name, Last Name, Admission No (or RollNo/Enrollment)</p>
        </div>
        
        {results && (
          <div className={`p-3 rounded-md text-sm font-medium ${results.success > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            Successfully imported {results.success} students. {results.errors > 0 && `${results.errors} rows failed validation.`}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
          {isUploading ? "Processing CSV..." : "Upload & Sync to Database"}
        </Button>
      </CardFooter>
    </Card>
  )
}
