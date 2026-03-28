'use client';

import { Suspense, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RoomClient } from '@/components/room-client';

function RoomPageInner() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();

  const initialGame = useMemo(() => search.get('game') ?? undefined, [search]);
  const nickname = useMemo(() => search.get('nickname') ?? 'Guest', [search]);

  return <RoomClient roomId={params.roomId.toUpperCase()} nickname={nickname} initialGame={initialGame} />;
}

export default function RoomPage() {
  return (
    <Suspense>
      <RoomPageInner />
    </Suspense>
  );
}
