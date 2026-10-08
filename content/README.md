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

3. **Annotate** – add fields by hand to the JSON:

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

4. **Seed**

   ```bash
   npm run db:seed
   ```

   Every move of every line is replayed and checked first. If any file has a
   problem, nothing is written and the error names the file and line.
