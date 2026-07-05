import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Atom, FlaskConical, Dna, ChevronRight } from "lucide-react";

interface SubjectCard {
  icon: React.ElementType;
  name: string;
  chapters: number;
  questions: number;
  color: string;
  gradient: string;
  slug: string;
}

const subjects: SubjectCard[] = [
  {
    icon: Atom,
    name: "Physics",
    chapters: 32,
    questions: 7500,
    color: "text-blue-600",
    gradient: "from-blue-500 to-blue-600",
    slug: "physics",
  },
  {
    icon: FlaskConical,
    name: "Chemistry",
    chapters: 30,
    questions: 8200,
    color: "text-green-600",
    gradient: "from-green-500 to-green-600",
    slug: "chemistry",
  },
  {
    icon: Dna,
    name: "Biology",
    chapters: 38,
    questions: 10500,
    color: "text-purple-600",
    gradient: "from-purple-500 to-purple-600",
    slug: "biology",
  },
];

export function SubjectCards() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Subjects</h2>
        <button 
          onClick={() => navigate('/practice')}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subjects.map((subject) => {
          const Icon = subject.icon;
          return (
            <Card
              key={subject.slug}
              className="cursor-pointer card-3d overflow-hidden group animate-tilt-in"
              style={{ animationDelay: `${subjects.indexOf(subject) * 100}ms` }}
              onClick={() => navigate('/practice')}
            >
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${subject.gradient} p-4 text-white relative overflow-hidden`}>
                  <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-xl group-hover:scale-150 transition-transform duration-500" />
                  <div className="flex items-center justify-between">
                    <Icon className="h-8 w-8 icon-3d" />
                    <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                      {subject.chapters} Chapters
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold mt-3">{subject.name}</h3>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{subject.questions.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Questions</p>
                  </div>
                  <div className="p-2 rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
