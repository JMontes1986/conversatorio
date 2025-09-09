
import { AdminAuth } from "@/components/auth/admin-auth";
import { AdminCreateUserForm } from "@/components/auth/admin-create-user-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateUserPage() {
    return (
        <AdminAuth>
             <div className="container mx-auto flex flex-col items-center justify-center py-10 md:py-20 px-4">
                <div className="w-full max-w-md">
                    <Button asChild variant="outline" size="sm" className="mb-4">
                        <Link href="/admin">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al Panel
                        </Link>
                    </Button>
                    <AdminCreateUserForm />
                </div>
            </div>
        </AdminAuth>
    );
}

    