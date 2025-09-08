"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UploadCloud, FileVideo, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function UploadPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setError(null);
            setUploadSuccess(false);
            // Validation
            if (!['video/mp4', 'video/quicktime'].includes(file.type)) {
                setError('Tipo de archivo no válido. Por favor, suba un archivo MP4 o MOV.');
                setSelectedFile(null);
                return;
            }
            if (file.size > 500 * 1024 * 1024) { // 500MB limit
                setError('El archivo es demasiado grande. El límite es de 500MB.');
                setSelectedFile(null);
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadProgress(0);
        setUploadSuccess(false);
        setError(null);

        // Simulate getting a pre-signed URL and uploading
        try {
            // Step 1: Get pre-signed URL from our server (simulated)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Step 2: Upload file to pre-signed URL (simulated with progress)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 95) return prev;
                    return prev + 5;
                });
            }, 200);

            await new Promise(resolve => setTimeout(resolve, 4000));
            clearInterval(progressInterval);
            setUploadProgress(100);

            // Finish up
            await new Promise(resolve => setTimeout(resolve, 500));
            setUploadSuccess(true);
            setSelectedFile(null);

        } catch (err) {
            setError("Ocurrió un error durante la subida. Inténtelo de nuevo.");
        } finally {
            setIsUploading(false);
        }
    };


    return (
        <div className="container mx-auto flex items-center justify-center py-10 md:py-20 px-4">
            <Card className="w-full max-w-xl">
                <CardHeader className="text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-primary mb-4" />
                    <CardTitle className="font-headline text-3xl">Envío de Video</CardTitle>
                    <CardDescription>
                        Suba la presentación de su equipo para la ronda actual.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="video-file">Archivo de Video (MP4, MOV, max 500MB)</Label>
                        <Input id="video-file" type="file" accept="video/mp4,video/quicktime" onChange={handleFileChange} disabled={isUploading}/>
                    </div>

                    {selectedFile && !isUploading && (
                        <div className="p-3 bg-secondary rounded-md flex items-center gap-3">
                            <FileVideo className="h-5 w-5 text-muted-foreground"/>
                            <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                            <span className="text-sm text-muted-foreground ml-auto">{Math.round(selectedFile.size / 1024 / 1024)} MB</span>
                        </div>
                    )}
                    
                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {isUploading && (
                        <div className="space-y-2">
                             <Progress value={uploadProgress} />
                             <p className="text-sm text-center text-muted-foreground">Subiendo... {uploadProgress}%</p>
                        </div>
                    )}
                    
                     {uploadSuccess && (
                        <Alert variant="default" className="bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                            <AlertTitle className="text-green-800 dark:text-green-200">¡Subida Exitosa!</AlertTitle>
                            <AlertDescription className="text-green-700 dark:text-green-300">
                                Su video ha sido enviado correctamente.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Button onClick={handleUpload} disabled={!selectedFile || isUploading} className="w-full" size="lg">
                        {isUploading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Subiendo...</>
                        ) : (
                            <>Subir Video</>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
