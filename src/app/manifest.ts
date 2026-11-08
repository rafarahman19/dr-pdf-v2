import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "dr.PdF — Asisten Belajar Dokumen AI",
    short_name: "dr.PdF",
    description:
      "Ubah PDF kuliah & sekolah menjadi ringkasan, kuis pilihan ganda A-E, flashcard spaced repetition, dan tanya-jawab dengan sitasi halaman.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#070d0b",
    theme_color: "#047857",
    lang: "id",
    categories: ["education", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/maskable-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
