import Link from 'next/link';
import { Container, Button } from '@/components/ui';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <Container className="grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="font-display text-7xl font-extrabold text-gradient">404</p>
        <Compass className="mx-auto mt-4 h-12 w-12 text-muted-fg" />
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-muted-fg">The page you’re looking for doesn’t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/"><Button>Back home</Button></Link>
          <Link href="/search"><Button variant="outline">Browse products</Button></Link>
        </div>
      </div>
    </Container>
  );
}
