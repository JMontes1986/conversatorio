import { cn } from "@/lib/utils";

type Team = {
  name: string;
  score?: number;
};

type Match = {
  id: number;
  teams: [Team, Team];
  winner?: string;
};

type Round = {
  title: string;
  matches: Match[];
};

const bracketData: Round[] = [
  {
    title: "Cuartos de Final",
    matches: [
      { id: 1, teams: [{ name: "Águilas Doradas", score: 3 }, { name: "Pumas Analíticos", score: 2 }], winner: "Águilas Doradas" },
      { id: 2, teams: [{ name: "Leones Intrépidos", score: 1 }, { name: "Búhos Sabios", score: 4 }], winner: "Búhos Sabios" },
      { id: 3, teams: [{ name: "Tigres del Saber", score: 5 }, { name: "Jaguares Audaces", score: 0 }], winner: "Tigres del Saber" },
      { id: 4, teams: [{ name: "Cobras Estratégicas", score: 2 }, { name: "Halcones Reales", score: 3 }], winner: "Halcones Reales" },
    ],
  },
  {
    title: "Semifinales",
    matches: [
      { id: 5, teams: [{ name: "Águilas Doradas", score: 2 }, { name: "Búhos Sabios", score: 3 }], winner: "Búhos Sabios" },
      { id: 6, teams: [{ name: "Tigres del Saber", score: 4 }, { name: "Halcones Reales", score: 1 }], winner: "Tigres del Saber" },
    ],
  },
  {
    title: "Final",
    matches: [
      { id: 7, teams: [{ name: "Búhos Sabios" }, { name: "Tigres del Saber" }] },
    ],
  },
];

export function TournamentBracket() {
  return (
    <div className="w-full bg-card p-4 md:p-8 rounded-lg shadow-lg overflow-x-auto">
      <div className="flex justify-around items-stretch min-w-[1000px]">
        {bracketData.map((round, roundIndex) => (
          <div key={round.title} className="flex flex-col justify-around w-1/3">
            <h2 className="font-headline text-xl text-center font-bold mb-8">{round.title}</h2>
            <div className="space-y-12">
              {round.matches.map((match) => (
                <div key={match.id} className="relative">
                  <div className="flex flex-col justify-center h-full">
                    <div className="bg-background border rounded-lg p-3 space-y-2">
                      {match.teams.map((team, teamIndex) => (
                        <div
                          key={team.name}
                          className={cn(
                            "flex justify-between items-center p-2 rounded",
                            team.name === match.winner ? "bg-primary/20" : "",
                            team.name === "TBD" ? "text-muted-foreground" : ""
                          )}
                        >
                          <span
                            className={cn(
                              "font-medium",
                              team.name === match.winner ? "font-bold text-primary" : ""
                            )}
                          >
                            {team.name}
                          </span>
                          {team.score !== undefined && (
                             <span className={cn(
                              "font-bold text-sm px-2 py-0.5 rounded",
                              team.name === match.winner ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {team.score}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Connectors */}
                  {roundIndex < bracketData.length - 1 && (
                     <div className="absolute top-1/2 -right-6 w-6 h-full">
                        <div className="h-full w-px bg-border absolute left-1/2"></div>
                        <div className="absolute top-1/2 -translate-y-1/2 w-full h-px bg-border"></div>
                     </div>
                  )}
                   {roundIndex > 0 && (
                     <div className="absolute top-1/2 -left-6 w-6 h-full">
                        <div className={cn("absolute w-full h-px bg-border", match.id % 2 !== 0 ? 'top-[calc(50%_+_2px)]' : 'top-[calc(50%_+_2px)]')}></div>
                     </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
