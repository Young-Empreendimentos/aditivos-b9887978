import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Quitacao = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao menu
          </Link>
        </Button>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
              <Construction className="h-7 w-7 text-muted-foreground" />
            </div>
            <CardTitle>Quitação</CardTitle>
            <CardDescription>Página em construção</CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Esta funcionalidade estará disponível em breve.
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Quitacao;
