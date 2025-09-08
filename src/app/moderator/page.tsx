
"use client";

import { ModeratorAuth } from "@/components/auth/moderator-auth";
import { DebateControlPanel } from "@/components/debate-control-panel";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
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
                    Gestione la ronda de debate actual.
                </p>
            </div>
            <DebateControlPanel registeredSchools={schools} allScores={scores}/>
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
