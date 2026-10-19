# Course content

Official courses live here as `<slug>.json` (seeded into the database) and
`<slug>.pgn` (for reviewing in any chess program). Both are committed.

All lines are generated from public Lichess opening data and annotated by us.
Never copy another platform's courses, comments, or line selections.

## Pipeline

1. **Generate**

   ```bash
   npm run generate-course -- --name "London System" --side white --moves "d4 d5 Bf4" --out content/london-system
   ```

   Needs `LICHESS_TOKEN` in `server/.env` (a personal token with no scopes, from
   https://lichess.org/account/oauth/token). Responses are cached in
   `.explorer-cache/`, so re-runs are fast and do not hit Lichess again.

   Useful flags: `--max-ply 20`, `--max-lines 60`, `--min-share 0.05`,
   `--min-games 100`. The generator refuses to overwrite an existing JSON file
   unless you pass `--force`, because that file holds your annotations.

2. **Review** – open the PGN, then delete lines from the JSON that are too long,
   redundant, or unplayable. Aim for 25–60 lines. Line order in the file is the
   order users learn them.

3. **Add checkmate lines**

   ```bash
   npm run find-mates -- --course london-system           # report only
   npm run find-mates -- --course london-system --write   # add them
   ```

   Looks at every position in the course where the opponent moves, finds replies
   real players make that allow a forced mate, and asks Stockfish for it. Each
   new line follows the course's own moves up to the mistake, then the fastest
   mate against the best defence, and is checked to end in checkmate. The lines
   are named "Checkmate: ..." and go at the end of the file, with a short
   comment on the mistake. Re-running replaces them.
   Flags: `--count 4`, `--max-mate 7`, `--min-share 0.005`, `--min-games 10`,
   `--depth 14`, `--ratings club` (Lichess 1400-2000) or `--ratings casual`
   (1000-1200, where these mistakes are far more common; slower the first time,
   since those answers are not cached yet).

4. **Annotate** – add fields by hand to the JSON:

   ```json
   {
     "pitch": "One punchy sentence.",
     "description": "Two sentences in our own voice.",
     "difficulty": "BEGINNER",
     "lines": [
       { "name": "...", "moves": ["d4", "d5", "Bf4"], "comments": { "3": "Bishop out before e3." } }
     ]
   }
   ```

   Comment keys are ply numbers: 1 is White's first move, 2 is Black's first move.

5. **Seed**

   ```bash
   npm run db:seed
   ```

   Every move of every line is replayed and checked first. If any file has a
   problem, nothing is written and the error names the file and line.
