import { Heading } from '@/components/ui/Heading';

export default function Home() {
  return (
    <main
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-light)',
      }}
    >
      <Heading variant="h1" align="center">
        SGRAI Terreno — Municipalidad de Valdivia
      </Heading>
    </main>
  );
}
