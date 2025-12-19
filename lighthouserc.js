export default {
    ci: {
        collect: {
            startServerCommand: "pnpm preview",
            startServerReadyPattern: "Local:",
            url: ["http://localhost:4173/"],
            numberOfRuns: 3,
            settings: {
                preset: "desktop",
            },
        },
        assert: {
            assertions: {
                "categories:performance": ["error", {minScore: 0.9}],
                "categories:accessibility": ["error", {minScore: 0.9}],
                "categories:best-practices": ["error", {minScore: 0.9}],
                "categories:seo": ["error", {minScore: 0.9}],
                "categories:pwa": ["warn", {minScore: 0.8}],

                // Ignore some rules
                "network-dependency-tree-insight": "off",
                "unused-javascript": "off",
                "render-blocking-insight": "off",
                "render-blocking-resources": "off"
            },
        },
        upload: {
            target: "temporary-public-storage",
        },
    },
};