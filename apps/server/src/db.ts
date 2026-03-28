import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({ connectionString: config.postgresUrl });

export async function recordRoomEvent(input: {
  roomId: string;
  gameKind: string;
  eventType: string;
  payload?: unknown;
}) {
  if (!config.persistMatchEvents) return;
  const payloadText = JSON.stringify(input.payload ?? {});
  await pool.query(
    `insert into room_events (room_id, game_kind, event_type, payload, payload_encrypted)
     values ($1, $2, $3, '{}'::jsonb, pgp_sym_encrypt($4, $5))`,
    [input.roomId, input.gameKind, input.eventType, payloadText, config.dataEncryptionKey]
  );
}

export async function recordMatchSummary(input: {
  roomId: string;
  gameKind: string;
  winnerPlayerId?: string;
  playerCount: number;
  summary?: unknown;
  startedAt?: Date;
  endedAt?: Date;
}) {
  if (!config.persistMatchEvents) return;
  const summaryText = JSON.stringify(input.summary ?? {});
  await pool.query(
    `insert into match_summaries (
      room_id, game_kind, winner_player_id, player_count, summary, summary_encrypted, started_at, ended_at
    ) values ($1, $2, $3, $4, '{}'::jsonb, pgp_sym_encrypt($5, $8), $6, $7)`,
    [
      input.roomId,
      input.gameKind,
      input.winnerPlayerId ?? null,
      input.playerCount,
      summaryText,
      input.startedAt ?? null,
      input.endedAt ?? null,
      config.dataEncryptionKey
    ]
  );
}
