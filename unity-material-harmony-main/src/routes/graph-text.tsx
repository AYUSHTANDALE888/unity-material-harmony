import { createFileRoute } from "@tanstack/react-router";
import { GraphView } from "./graph";

export const Route = createFileRoute("/graph-text")({
  head: () => ({
    meta: [
      { title: "Graph Text — Material Knowledge Graph & Semantic Intelligence — NUMM" },
      {
        name: "description",
        content: "Text-to-graph material standardisation, entity extraction, and CPSE duplicate discovery.",
      },
    ],
  }),
  component: GraphView,
});
