# Multi-Repo Architecture Design

## Vision

We are transitioning from **single-project development** to a **"Meta-Layer" architecture**, inspired by Yocto/embedded Linux build systems. This allows:

1.  **Reusable Agent Environment**: AI development tooling (`workflows/`, `validate.sh`) shared across all projects.
2.  **Unified Deployment**: Host multiple apps (Papeterie Engine, Inkado) on a single PythonAnywhere slot.
3.  **Open Source**: All components will be MIT-licensed for community contribution.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     papeterie-suite                          │
│  (Meta-Repo / Deployment Container)                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   .agent/    │  │   engine/    │  │   inkado/    │       │
│  │  (submodule) │  │  (submodule) │  │  (submodule) │       │
│  │              │  │              │  │              │       │
│  │  - workflows │  │  - src/      │  │  - backend/  │       │
│  │  - bin/      │  │  - assets/   │  │  - frontend/ │       │
│  │  - config    │  │  - docs/     │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  wsgi.py  ──▶  Routes: / → Engine, /inkado → Inkado        │
│  requirements.txt  ──▶  Merged dependencies                 │
└─────────────────────────────────────────────────────────────┘
```

## Repositories

| Repo | Purpose | License |
| :--- | :--- | :--- |
| `agent-dev-environment` | Shared AI agent tooling | MIT |
| `papeterie-engine` | 2D Animation Engine | MIT |
| `inkado` | AI Writing Assistant | MIT |
| `papeterie-suite` | Deployment container | MIT |

## Roadmap (Next Steps)

1.  **Phase 0**: Clean up and tag all repos.
2.  **Phase 1**: Extract and publish `agent-dev-environment`.
3.  **Phase 2**: Make `inkado` public.
4.  **Phase 3**: Create `papeterie-suite` meta-repo.
5.  **Phase 4**: Deploy to PythonAnywhere.

## Related Documents
*   [HOWTO Deploy PythonAnywhere](../HOWTO_Deploy_PythonAnywhere.md)
*   [Deployment Design](deployment.md)

