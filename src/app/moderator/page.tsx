
"use client";

import { ModeratorAuth } from "@/components/auth/moderator-auth";
import { DebateControlPanel } from "@/components/debate-control-panel";
import { RoundManagement } from "@/components/round-management";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Gavel, Swords } from "lucide-react";
import { useEffect, useState } from "react";

interface SchoolData {
    id: string;
    schoolName: string;
    teamName: string;
}

interface ScoreData {
    id: string;
    matchId: string;
    judgeName: string;
    teams: { name: string; total: number }[];
}

function ModeratorDashboard() {
    const [schools, setSchools] = useState<SchoolData[]>([]);
    const [scores, setScores] = useState<ScoreData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const schoolsQuery = query(collection(db, "schools"), orderBy("createdAt", "desc"));
        const unsubscribeSchools = onSnapshot(schoolsQuery, (querySnapshot) => {
            const schoolsData: SchoolData[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                schoolsData.push({
                    id: doc.id,
                    schoolName: data.schoolName,
                    teamName: data.teamName,
                });
            });
            setSchools(schoolsData);
            if (loading) setLoading(false);
        }, (error) => {
            console.error("Error fetching schools:", error);
            if (loading) setLoading(false);
        });

        const scoresQuery = query(collection(db, "scores"), orderBy("createdAt", "desc"));
        const unsubscribeScores = onSnapshot(scoresQuery, (querySnapshot) => {
            const scoresData: ScoreData[] = [];
            querySnapshot.forEach((doc) => {
                scoresData.push({ id: doc.id, ...doc.data()} as ScoreData);
            });
            setScores(scoresData);
            if (loading) setLoading(false);
        });

        return () => {
          unsubscribeSchools();
          unsubscribeScores();
        }
    }, []);

    return (
         <div className="container mx-auto py-10 px-4 md:px-6">
            <div className="mb-8">
                <h1 className="font-headline text-3xl md:text-4xl font-bold">
                    Panel de Moderador
                </h1>
                <p className="text-muted-foreground mt-2">
                    Gestione la estructura y el flujo de la competencia.
                </p>
            </div>
            <Tabs defaultValue="debate-control" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="rounds"><Swords className="mr-2 h-4 w-4" />Gestión de Rondas</TabsTrigger>
                    <TabsTrigger value="debate-control"><Gavel className="mr-2 h-4 w-4" />Control del Debate</TabsTrigger>
                </TabsList>
                <TabsContent value="rounds">
                    <RoundManagement />
                </TabsContent>
                <TabsContent value="debate-control">
                    <DebateControlPanel registeredSchools={schools} allScores={scores}/>
                </TabsContent>
            </Tabs>
        </div>
    )
}


export default function ModeratorPage() {
    return (
        <ModeratorAuth>
            <ModeratorDashboard />
        </ModeratorAuth>
    );
}
