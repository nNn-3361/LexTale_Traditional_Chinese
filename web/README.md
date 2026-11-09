# Test page

The page participants use, built with jsPsych 8 and TypeScript (Vite).

## Flow

1. Session code (from the link `/?s=CODE` or typed in)
2. Consent. In research mode, an optional participant code follows
3. All images are preloaded before any trial starts, so loading time does not
   affect reaction times
4. Instructions, then practice items with feedback
5. Test items in the order set by the server (random per run unless the form
   is set otherwise), each after a 500 ms fixation cross
6. Remaining responses are sent, then the score (formal mode) or a thank-you
   message (research mode) is shown

Participants answer with the F key (real character) and J key (not a real
character), or by tapping the buttons on phones and tablets. The reaction
time is measured from the first frame on which the image is shown. Each
response is sent to the server right away and retried if the connection
fails.

The page holds no items. It gets the trial list and image URLs from the server.

## Development

```sh
cd web
npm install
npm run dev      # http://localhost:5173, forwards /api and /media to port 8000
npm run build    # writes dist/
```

The backend must be running on port 8000 (see `server/README.md`).

Participant-facing text is in `src/text.ts`. The consent text there is a
placeholder [TBD]; the final text needs ethics review approval. When it
changes, update `CONSENT_VERSION` in `src/text.ts` and the server's
`CONSENT_VERSION` setting together.
