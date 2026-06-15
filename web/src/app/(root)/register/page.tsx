"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building2, Mail, Phone, Users, Globe, CheckCircle2 } from "lucide-react";

// Strict Zod Validation Schema
const registrationSchema = z.object({
  school_name: z.string().min(3, "School name must be at least 3 characters"),
  subdomain: z
    .string()
    .min(3, "Subdomain must be at least 3 characters")
    .regex(/^[a-z0-9]+$/, "Subdomain can only contain lowercase letters and numbers (no spaces)"),
  admin_name: z.string().min(2, "Admin name is required"),
  admin_email: z.string().email("Invalid email address"),
  admin_phone: z.string().min(10, "Phone number is too short"),
  expected_quota: z.string().transform((val) => parseInt(val, 10)).pipe(z.number().min(1, "Must have at least 1 student")),
});

type RegistrationFormValues = z.infer<typeof registrationSchema>;

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      school_name: "",
      subdomain: "",
      admin_name: "",
      admin_email: "",
      admin_phone: "",
      expected_quota: "500" as any, // initial string state before transform
    },
  });

  const onSubmit = async (data: RegistrationFormValues) => {
    setIsSubmitting(true);
    try {
      // TODO: Integrate with Supabase Client
      // const supabase = createClient();
      // const { error } = await supabase.from("registration_requests").insert([
      //   {
      //     school_name: data.school_name,
      //     subdomain: data.subdomain,
      //     admin_name: data.admin_name,
      //     admin_email: data.admin_email,
      //     status: "pending"
      //   }
      // ]);
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("Submitted Data ready for Supabase:", data);
      setIsSuccess(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center border-emerald-500/20 bg-emerald-500/5">
          <CardHeader>
            <div className="mx-auto bg-emerald-500/20 w-16 h-16 flex items-center justify-center rounded-full mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-2xl">Registration Received!</CardTitle>
            <CardDescription className="text-base mt-2">
              Your request for a new school environment has been securely submitted to the Super Admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              We will review your application and provision your isolated database schema shortly. You will receive an email once your tenant subdomain is live.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline" onClick={() => window.location.href = "/"}>
              Return Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Create your Institute</h1>
          <p className="text-muted-foreground mt-2">
            Deploy your secure, isolated cloud environment in seconds.
          </p>
        </div>

        <Card className="border-border/50 shadow-xl shadow-black/5 dark:shadow-white/5">
          <CardHeader>
            <CardTitle>Institute Details</CardTitle>
            <CardDescription>Enter the primary information for your SaaS tenant.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="school_name">School/Institute Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="school_name" className="pl-9" placeholder="GEMS Academy" {...register("school_name")} />
                  </div>
                  {errors.school_name && <p className="text-xs text-red-500">{errors.school_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subdomain">Desired Subdomain</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="subdomain" className="pl-9 pr-24" placeholder="gems" {...register("subdomain")} />
                    <div className="absolute right-3 top-3 text-xs text-muted-foreground font-mono">
                      .yoursaas.com
                    </div>
                  </div>
                  {errors.subdomain && <p className="text-xs text-red-500">{errors.subdomain.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="admin_name">Principal / Admin Name</Label>
                  <Input id="admin_name" placeholder="John Doe" {...register("admin_name")} />
                  {errors.admin_name && <p className="text-xs text-red-500">{errors.admin_name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin_phone">Contact Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="admin_phone" className="pl-9" placeholder="+1 (555) 000-0000" {...register("admin_phone")} />
                  </div>
                  {errors.admin_phone && <p className="text-xs text-red-500">{errors.admin_phone.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin_email">Admin Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="admin_email" type="email" className="pl-9" placeholder="admin@gemsacademy.edu" {...register("admin_email")} />
                </div>
                {errors.admin_email && <p className="text-xs text-red-500">{errors.admin_email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_quota">Expected Student Capacity</Label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="expected_quota" type="number" className="pl-9" placeholder="500" {...register("expected_quota")} />
                </div>
                <p className="text-xs text-muted-foreground">This helps us provision the correct pricing tier.</p>
                {errors.expected_quota && <p className="text-xs text-red-500">{errors.expected_quota.message}</p>}
              </div>

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isSubmitting}>
                {isSubmitting ? "Provisioning Engine..." : "Submit Registration Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
