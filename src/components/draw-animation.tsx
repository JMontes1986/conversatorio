
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shuffle, ShieldCheck, ShieldAlert, Loader2, Users, Send, EyeOff } from "lucide-react";
import { addDoc, collection, onSnapshot, query, where, doc, setDoc, orderBy, serverTimestamp, writeBatch } from "@/lib/documents";
import { db } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  type DrawIntegrity,
  type DrawMatchup,
  normalizeDrawMatchups,
  sealGroupDraw,
  secureShuffle,
  verifyGroupDraw,
} from "@/lib/draw-integrity";
import {
  DEFAULT_TOURNAMENT_FORMAT,
  type TournamentFormat,
  expectedQualifierCount,
  requiredRoundCount,
  normalizeTournamentFormat,
} from "@/lib/tournament-format";

const DRAW_STATE_DOC_ID = "liveDraw";
const DEBATE_STATE_DOC_ID = "current";

type Team = {
  id: string;
  name: string;
};

type RoundData = {
    id: string;
    name: string;
    phase: string;
}

type Phase = {
    name: string;
    matchups: DrawMatchup[];
}
type LiveDrawState = {
    phases: Phase[];
    integrity?: DrawIntegrity;
    tournamentFormat?: TournamentFormat;
}

type IntegrityStatus = "none" | "checking" | "valid" | "invalid";

function groupLabel(index: number) {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}

function sameTeamSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((team) => rightSet.has(team));
}

export function DrawAnimation() {
  const { toast } = useToast();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allRounds, setAllRounds] = useState<RoundData[]>([]);
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>(DEFAULT_TOURNAMENT_FORMAT);
  const [drawTournamentFormat, setDrawTournamentFormat] = useState<TournamentFormat | null>(null);
  const [isSavingFormat, setIsSavingFormat] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [integrity, setIntegrity] = useState<DrawIntegrity | null>(null);
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus>("none");
  
  const [assignedTeams, setAssignedTeams] = useState<DrawMatchup[]>([]);
  const [isPublicDrawActive, setIsPublicDrawActive] = useState(false);
  const [isPublishingDraw, setIsPublishingDraw] = useState(false);


 useEffect(() => {
    setLoading(true);
    const unsubTeams = onSnapshot(query(collection(db, "schools"), where("status", "==", "Verificado")), (snapshot) => {
        const fetchedTeams = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().teamName,
        }));
        setAllTeams(fetchedTeams);
    }, (error) => {
        console.error("Error fetching teams: ", error);
    });

    const unsubRounds = onSnapshot(query(collection(db, "rounds"), orderBy("createdAt", "asc")), (snapshot) => {
        const roundsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoundData));
        setAllRounds(roundsData);
    });

    const settingsRef = doc(db, "settings", "competition");
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      const data = docSnap.exists() ? docSnap.data() : {};
      setTournamentFormat(normalizeTournamentFormat(data.tournamentFormat));
    });

    const drawStateRef = doc(db, "drawState", DRAW_STATE_DOC_ID);
    const unsubDrawState = onSnapshot(drawStateRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as LiveDrawState;
            setDrawTournamentFormat(data.tournamentFormat ? normalizeTournamentFormat(data.tournamentFormat) : null);
            const groupPhase = data.phases?.find(p => p.name === "Fase de Grupos");
            if (groupPhase && groupPhase.matchups.length > 0) {
                setAssignedTeams(normalizeDrawMatchups(groupPhase.matchups));
                setIntegrity(data.integrity ?? null);
                setIsFinished(true); // Mark as finished if there's a saved state
            } else {
                setAssignedTeams([]);
                setIntegrity(null);
                setIsFinished(false);
            }
        } else {
            setAssignedTeams([]);
            setIntegrity(null);
            setDrawTournamentFormat(null);
            setIsFinished(false);
        }
        setLoading(false);
    });
    
    return () => {
      unsubTeams();
      unsubRounds();
      unsubSettings();
      unsubDrawState();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "debateState", DEBATE_STATE_DOC_ID),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setIsPublicDrawActive(data.publicDraw?.active === true);
      },
      (error) => {
        console.error("Error loading public draw state:", error);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (assignedTeams.length === 0 || !integrity) {
      setIntegrityStatus("none");
      return;
    }

    setIntegrityStatus("checking");
    void verifyGroupDraw(assignedTeams, integrity).then((isValid) => {
      if (!cancelled) setIntegrityStatus(isValid ? "valid" : "invalid");
    });

    return () => {
      cancelled = true;
    };
  }, [assignedTeams, integrity]);

  const groupRounds = allRounds.filter((round) => round.phase === "Fase de Grupos");
  const groupFormat = tournamentFormat.groupStage;
  const semifinalFormat = tournamentFormat.semifinals;
  const finalFormat = tournamentFormat.final;
  const projectedGroupRounds = requiredRoundCount(allTeams.length, groupFormat.teamsPerRound);
  const projectedSemifinalTeams = expectedQualifierCount(allTeams.length, groupFormat);
  const projectedSemifinalRounds = requiredRoundCount(projectedSemifinalTeams, semifinalFormat.teamsPerRound);
  const projectedFinalTeams = projectedSemifinalRounds * semifinalFormat.qualifiersPerRound;
  const projectedFinalRounds = requiredRoundCount(projectedFinalTeams, finalFormat.teamsPerRound);
  const assignedTeamNames = assignedTeams.flatMap((matchup) => matchup.teams);
  const eligibleTeamNames = allTeams.map((team) => team.name);
  const drawMatchesCurrentSetup = sameTeamSet(assignedTeamNames, eligibleTeamNames)
    && assignedTeams.length === groupRounds.length
    && assignedTeams.every((matchup, index) => matchup.roundName === groupRounds[index]?.name)
    && Boolean(drawTournamentFormat)
    && JSON.stringify(drawTournamentFormat) === JSON.stringify(tournamentFormat);

  const updatePhaseFormat = (
    phase: keyof TournamentFormat,
    field: "teamsPerRound" | "qualifiersPerRound",
    rawValue: string,
  ) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setTournamentFormat((current) => normalizeTournamentFormat({
      ...current,
      [phase]: {
        ...current[phase],
        [field]: parsed,
      },
    }));
  };

  const saveTournamentFormat = async () => {
    setIsSavingFormat(true);
    try {
      await setDoc(
        doc(db, "settings", "competition"),
        { tournamentFormat },
        { merge: true },
      );
      toast({
        title: "Formato guardado",
        description: "La cantidad de equipos y clasificados por fase quedó actualizada.",
      });
    } catch (error) {
      console.error("Error saving tournament format:", error);
      toast({
        variant: "destructive",
        title: "No se pudo guardar el formato",
        description: "Revise la conexión e inténtelo nuevamente.",
      });
    } finally {
      setIsSavingFormat(false);
    }
  };

  const startDraw = async () => {
    if (allTeams.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No hay equipos verificados para realizar el sorteo.' });
      return;
    }

    const requiredRounds = requiredRoundCount(allTeams.length, groupFormat.teamsPerRound);
    if (groupRounds.length > requiredRounds) {
      toast({
        variant: "destructive",
        title: "Las rondas no coinciden con los equipos",
        description: `Con ${allTeams.length} equipos se necesitan ${requiredRounds} rondas de grupo, pero hay ${groupRounds.length}. Elimine las rondas sobrantes.`,
      });
      return;
    }

    setIsDrawing(true);
    setIsFinished(false);
    setAssignedTeams([]);
    setIntegrity(null);

    try {
      await setDoc(
        doc(db, "settings", "competition"),
        { tournamentFormat },
        { merge: true },
      );

      let roundsForDraw = groupRounds;
      if (roundsForDraw.length < requiredRounds) {
        const existingNames = new Set(allRounds.map((round) => round.name.trim().normalize("NFC")));
        const missingRounds: RoundData[] = [];
        let labelIndex = 0;

        while (roundsForDraw.length + missingRounds.length < requiredRounds) {
          const name = `Grupo ${groupLabel(labelIndex)}`;
          labelIndex += 1;
          if (existingNames.has(name)) continue;
          existingNames.add(name);
          const roundRef = await addDoc(collection(db, "rounds"), {
            name,
            phase: "Fase de Grupos",
            createdAt: serverTimestamp(),
          });
          missingRounds.push({ id: roundRef.id, name, phase: "Fase de Grupos" });
        }

        roundsForDraw = [...roundsForDraw, ...missingRounds];
        setAllRounds((current) => [...current, ...missingRounds]);
      }

      const shuffledTeams = secureShuffle(allTeams);
      const matchups: DrawMatchup[] = [];
      const teamsPerRound = groupFormat.teamsPerRound;

      for (let i = 0; i < roundsForDraw.length; i++) {
          const round = roundsForDraw[i];
          const teamsForThisRound = shuffledTeams.slice(i * teamsPerRound, (i * teamsPerRound) + teamsPerRound).map(t => t.name);
          if (teamsForThisRound.length > 0) {
              matchups.push({ roundName: round.name, teams: teamsForThisRound });
          }
      }

      // Reveal each matchup before publishing the exact same data to the bracket.
      for (let i = 0; i < matchups.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setAssignedTeams(current => [...current, matchups[i]]);
      }

      const sealedIntegrity = await sealGroupDraw(matchups);
      const drawState: LiveDrawState = {
        tournamentFormat,
        phases: [{
            name: "Fase de Grupos",
            matchups: matchups
        }],
        integrity: sealedIntegrity,
      };

      const bracketTeamOrder = matchups.flatMap((matchup) => matchup.teams);
      const batch = writeBatch(db);
      batch.set(doc(db, "drawState", DRAW_STATE_DOC_ID), drawState);
      batch.set(doc(db, "debateState", DEBATE_STATE_DOC_ID), {
        bracketSeedingMode: "automatic",
        bracketTeamOrder,
        bracketTeams: bracketTeamOrder,
        bracketManualAccepted: false,
        bracketManualAcceptedAt: null,
        bracketAutomaticRandomizedAt: sealedIntegrity.sealedAt,
        bracketConfigurationUpdatedAt: sealedIntegrity.sealedAt,
      }, { merge: true });
      await batch.commit();
      setIntegrity(sealedIntegrity);
      setDrawTournamentFormat(tournamentFormat);
      setIntegrityStatus("valid");
      setIsFinished(true);
      toast({
        title: "Sorteo y bracket sincronizados",
        description: "Las mismas llaves ya están visibles en el bracket automático.",
      });
    } catch (error) {
      console.error("Error creating or saving draw state:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar y sincronizar el sorteo.' });
    } finally {
      setIsDrawing(false);
    }
  };
  
  const publishDrawToDebate = async () => {
    if (!isFinished || assignedTeams.length === 0 || !integrity || integrityStatus === "invalid") {
      toast({
        variant: "destructive",
        title: "Sorteo no disponible",
        description: "Complete y verifique primero el sorteo antes de publicarlo.",
      });
      return;
    }

    setIsPublishingDraw(true);
    try {
      await setDoc(
        doc(db, "debateState", DEBATE_STATE_DOC_ID),
        {
          publicDraw: {
            active: true,
            publishedAt: new Date().toISOString(),
          },
          videoUrl: "",
          temporaryImageUrl: "",
          studentQuestionOverlay: null,
        },
        { merge: true },
      );
      toast({
        title: "Sorteo enviado a Debate",
        description: "El público ya puede ver las rondas sorteadas y el hash SHA-256.",
      });
    } catch (error) {
      console.error("Error publishing draw:", error);
      toast({
        variant: "destructive",
        title: "No se pudo publicar",
        description: "Revise la conexión e inténtelo nuevamente.",
      });
    } finally {
      setIsPublishingDraw(false);
    }
  };

  const hideDrawFromDebate = async () => {
    setIsPublishingDraw(true);
    try {
      await setDoc(
        doc(db, "debateState", DEBATE_STATE_DOC_ID),
        {
          publicDraw: {
            active: false,
            hiddenAt: new Date().toISOString(),
          },
        },
        { merge: true },
      );
      toast({
        title: "Sorteo ocultado",
        description: "La pantalla de Debate volvió al contenido normal.",
      });
    } catch (error) {
      console.error("Error hiding draw:", error);
      toast({
        variant: "destructive",
        title: "No se pudo ocultar",
        description: "Revise la conexión e inténtelo nuevamente.",
      });
    } finally {
      setIsPublishingDraw(false);
    }
  };

  const handleIntegrity = async () => {
    if (assignedTeams.length === 0) return;
    setIsCheckingIntegrity(true);
    try {
      if (!integrity) {
        const sealedIntegrity = await sealGroupDraw(assignedTeams);
        await setDoc(
          doc(db, "drawState", DRAW_STATE_DOC_ID),
          { integrity: sealedIntegrity },
          { merge: true },
        );
        setIntegrity(sealedIntegrity);
        setIntegrityStatus("valid");
        toast({
          title: "Sorteo sellado",
          description: "Se generó el hash SHA-256 para proteger la integridad del resultado.",
        });
        return;
      }

      const isValid = await verifyGroupDraw(assignedTeams, integrity);
      setIntegrityStatus(isValid ? "valid" : "invalid");
      toast(isValid ? {
        title: "Integridad verificada",
        description: "Las rondas y los equipos coinciden con el hash SHA-256 guardado.",
      } : {
        variant: "destructive",
        title: "El sorteo fue alterado",
        description: "El contenido actual no coincide con el hash guardado. El bracket automático no lo utilizará.",
      });
    } catch (error) {
      console.error("Error checking draw integrity:", error);
      toast({
        variant: "destructive",
        title: "No se pudo verificar el sorteo",
        description: "Inténtelo nuevamente.",
      });
    } finally {
      setIsCheckingIntegrity(false);
    }
  };


  return (
    <div className="w-full max-w-6xl mx-auto">
        <div className="space-y-1 mb-8">
            <h1 className="font-headline text-3xl font-bold">Sorteo Automático de Grupos</h1>
            <p className="text-muted-foreground">Realice el sorteo para la Fase de Grupos. El resultado se reflejará para el público.</p>
        </div>

        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Formato del Torneo</CardTitle>
                <CardDescription>
                    Defina cuántos equipos compiten y cuántos clasifican en cada fase. Con la configuración actual:
                    {" "}{allTeams.length} equipos → {projectedSemifinalTeams} semifinalistas → {projectedFinalTeams} finalistas.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                    {([
                      ["groupStage", "Ronda inicial", groupFormat, projectedGroupRounds],
                      ["semifinals", "Semifinal", semifinalFormat, projectedSemifinalRounds],
                      ["final", "Final", finalFormat, projectedFinalRounds],
                    ] as const).map(([key, title, phaseFormat, projectedRounds]) => (
                      <div key={key} className="space-y-3 rounded-lg border p-4">
                        <div>
                          <p className="font-semibold">{title}</p>
                          <p className="text-xs text-muted-foreground">
                            {projectedRounds} {projectedRounds === 1 ? "ronda" : "rondas"} proyectadas
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-teams`}>Equipos por ronda</Label>
                          <Input
                            id={`${key}-teams`}
                            type="number"
                            min={2}
                            value={phaseFormat.teamsPerRound}
                            onChange={(event) => updatePhaseFormat(key, "teamsPerRound", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-qualifiers`}>Clasifican por ronda</Label>
                          <Input
                            id={`${key}-qualifiers`}
                            type="number"
                            min={1}
                            max={Math.max(1, phaseFormat.teamsPerRound - 1)}
                            value={phaseFormat.qualifiersPerRound}
                            onChange={(event) => updatePhaseFormat(key, "qualifiersPerRound", event.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-3 text-sm">
                  <span>
                    Formato actual: <strong>{groupFormat.teamsPerRound}/{groupFormat.qualifiersPerRound}</strong>
                    {" → "}<strong>{semifinalFormat.teamsPerRound}/{semifinalFormat.qualifiersPerRound}</strong>
                    {" → "}<strong>{finalFormat.teamsPerRound}/{finalFormat.qualifiersPerRound}</strong>
                  </span>
                  <Button type="button" variant="secondary" onClick={saveTournamentFormat} disabled={isSavingFormat}>
                    {isSavingFormat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar formato
                  </Button>
                </div>
            </CardContent>
        </Card>

        <Card className="mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Equipos Elegibles para el Sorteo</CardTitle>
                <CardDescription>Esta es la lista de equipos que participarán en el sorteo de la Fase de Grupos.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                     <p className="text-muted-foreground">Cargando equipos...</p>
                ) : allTeams.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {allTeams.map(team => (
                            <div key={team.id} className="p-2 bg-secondary rounded-md text-secondary-foreground font-medium text-sm">
                                {team.name}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No hay equipos elegibles. Verifique que los colegios estén 'Verificado'.</p>
                )}
            </CardContent>
        </Card>
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div className="space-y-1">
                <h2 className="font-headline text-2xl font-bold">Rondas de Grupos</h2>
                <p className="text-muted-foreground">
                    Observe cómo los equipos son asignados aleatoriamente a sus rondas iniciales.
                </p>
            </div>
            <div className="flex gap-2">
                <Button onClick={startDraw} disabled={isDrawing || loading || allTeams.length === 0}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Shuffle className="mr-2 h-4 w-4" />}
                    {loading ? "Cargando..." : isFinished ? "Volver a Sortear" : "Iniciar Sorteo"}
                </Button>
            </div>
        </div>

        {loading ? (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : allTeams.length === 0 ? (
            <div className="flex justify-center items-center min-h-[400px] bg-secondary/50 rounded-lg">
                <p className="text-muted-foreground text-center px-4">
                    No hay colegios verificados para el sorteo.
                </p>
            </div>
        ) : groupRounds.length === 0 ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-lg bg-secondary/50">
                <p className="max-w-lg px-4 text-center text-muted-foreground">
                    Al iniciar el sorteo se crearán automáticamente las rondas necesarias y sus llaves se copiarán al bracket.
                </p>
            </div>
        ) : (
            <div className="grid min-h-[400px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {groupRounds.map(round => {
                const matchup = assignedTeams.find(m => m.roundName === round.name);
                return (
                    <Card key={round.id} className="flex flex-col">
                        <CardHeader>
                            <CardTitle className="font-headline text-center">{round.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-2 relative">
                            {matchup?.teams.map((teamName, index) => (
                                <div key={`${teamName}-${index}`} className="p-3 bg-secondary rounded-md text-secondary-foreground font-medium text-center animate-in fade-in-50 duration-500">
                                    {teamName}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )
            })}
            </div>
        )}

      {isFinished && (
        <div className="mt-8 text-center flex flex-col items-center gap-4 animate-in fade-in-50">
            <h2 className="font-headline text-2xl font-bold">
              {drawMatchesCurrentSetup ? "¡Sorteo Completado!" : "Sorteo desactualizado"}
            </h2>
            <p className="text-muted-foreground">
              {drawMatchesCurrentSetup
                ? "Los grupos han sido definidos y se reflejan exactamente igual en el bracket automático."
                : "Los equipos o las rondas cambiaron. Vuelva a sortear para sincronizar el bracket."}
            </p>
            {integrity && (
              <div className="max-w-full rounded-lg border bg-muted/40 px-4 py-3 text-left">
                <p className="flex items-center justify-center gap-2 text-sm font-semibold">
                  {integrityStatus === "invalid" ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                  {integrityStatus === "invalid" ? "Hash inválido" : "Sello de integridad SHA-256"}
                </p>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{integrity.hash}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={publishDrawToDebate}
                disabled={
                  isPublishingDraw
                  || isPublicDrawActive
                  || !drawMatchesCurrentSetup
                  || integrityStatus === "invalid"
                }
                size="lg"
              >
                {isPublishingDraw
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Send className="mr-2 h-4 w-4" />}
                {isPublicDrawActive ? "Visible en Debate" : "Enviar Sorteo a Debate"}
              </Button>

              <Button
                onClick={hideDrawFromDebate}
                disabled={isPublishingDraw || !isPublicDrawActive}
                size="lg"
                variant="outline"
              >
                <EyeOff className="mr-2 h-4 w-4" />
                Ocultar Sorteo
              </Button>

              <Button onClick={handleIntegrity} disabled={isCheckingIntegrity} size="lg" variant="secondary" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  {isCheckingIntegrity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  {isCheckingIntegrity ? "Verificando..." : integrity ? "Verificar Integridad" : "Sellar Sorteo Actual"}
              </Button>
            </div>
        </div>
      )}
    </div>
  );
}
