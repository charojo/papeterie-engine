# The AI Partnership: QA Workflows & Agentic Tooling

*How pairing with an LLM agent transformed debugging, testing, and the development mindset*

---

> [!NOTE]
> This post consolidates our findings on human-AI collaboration, tiered validation systems, and the "Agent-in-the-Loop" methodology developed during the Papeterie Engine's creation.

---

### The Evolution of the AI Partnership

Our collaboration evolved through three distinct phases as the project's complexity grew:

1. **Phase 1: Guided Implementation (The Assistant)**: The agent acted as a high-speed assistant, generating code from detailed prompts. Artifacts were mostly pure source code blobs.
2. **Phase 2: Autonomous Troubleshooting (The Consultant)**: The relationship shifted to diagnostic inquiry. The agent researched symptoms (e.g., WSL lag), hypothesized, and proposed environmental fixes.
3. **Phase 3: Meta-Toolbuilding (The Meta-Developer)**: The agent began improving the *development process* itself. Features like the tiered validation system were proposed as workflow solutions, not just line-by-line tasks.

### Understanding "Prompt Memory"

One of the most powerful aspects of this partnership is the record of our collaboration—the **Prompt History**. More than just a log, it serves as a **Catastrophe Recovery** layer. 

Even when the local disk state is wiped (an accidental `git reset --hard` or a corrupted branch), the **Intent and Reasoning** survive in the AI partner's memory. This allows for:
- **Instant Re-Implementation**: Restoring hours of work in minutes by asking the partner to "Remember that selection logic fix."
- **Immutable Context**: Access to the *why* behind complex decisions, even if the git history is mangled.
- **Fearless Iteration**: Experimenting aggressively knowing the AI partner acts as an off-disk backup of the conceptual architecture.

| Feature | Git History (The *What*) | Prompt History (The *How* & *Why*) |
|---------|-------------------------|-----------------------------------|
| **Storage** | Local `.git` folder | AI Platform (Cloud) |
| **Resilience** | Wiped by local resets | Survives all local deletions |
| **Context** | Shows the final diff | Records reasoning and failed attempts |

#### Why isn't Prompt History in the Repository?

1. **Signal vs. Noise**: Git is for high-density summaries of state. Prompt history contains the "noise" (failed prototypes, reasoning) that would bury the source of truth if committed.
2. **The Compiler Analogy**: The AI partner is the compiler; prompts are the source. We check in the Source and Binary, not the compiler's internal memory.
3. **Verification vs. Generation**: Code in a repo is verifiable by tests. Prompt history is "fuzzy memory." The repo acts as a Hard Reset to prevent hallucinations.
4. **Context Window**: Keeping the repo clean saves "memory space" for the AI partner, allowing it to focus on relevant code without being overwhelmed by dialogue history.

### The Agent-in-the-Loop Workflow

The engine uses a collaborative debugging partner model where the agent handles research and implementation while the human provides vision and judgment.

```
     ┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
     │   OBSERVE   │────►│    DIAGNOSE     │────►│   IMPLEMENT      │
     │ User reports│     │ Agent researches│     │ Agent writes fix │
     │ symptom     │     │ codebase        │     │ + tests          │
     └─────────────┘     └─────────────────┘     └────────┬─────────┘
            ▲                                             │
            │            ┌─────────────────┐              │
            └────────────│    VERIFY       │◄─────────────┘
                         │ Run validation  │
                         └─────────────────┘
```

### Five "Aha!" Moments

1.  **Codebase Memory**: I stopped trying to load the entire system into my head. The agent can read 5 files in parallel and trace a callback chain in seconds.
2.  **Environment over Code**: The agent correctly diagnosed WSL display server issues as the cause of "lag," saving hours of fruitless code debugging.
3.  **Tests as Proof of Thought**: We moved to a "Write a failing test first" model. Tests became documentation of our shared understanding.
4.  **Parallel Exploration**: Instead of sequential debugging, the agent explores multiple potential failure points (UI, state, engine logic) simultaneously.
5.  **Meta-Toolbuilding**: The agent can build its own tools—like the entire `validate.sh` infrastructure—to improve the development process itself.

---

## Part 2: The QA Reasoning Loop

When validation detects a failing test, the agent follows a structured **chain-of-thought**:

![QA Reasoning Loop](../assets/diagrams/qa_reasoning_loop.png)
*[Source: qa_reasoning_loop.dot](../assets/diagrams/qa_reasoning_loop.dot)*

### Case Study: Drift Behavior Bug
**Failure**: `assert 100 == 50` in `test_drift_respects_cap`

| Step | Agent Action |
|------|--------------|
| **DETECT** | "DriftRuntime.apply() returned 100, expected 50" |
| **TRACE** | Read source: `apply()` has no cap logic |
| **HYPOTHESIZE** | "drift_cap not enforced in apply()" |
| **IMPLEMENT** | Added cap enforcement |
| **CONFIRM** | Test passes across both Python and JS runtimes |

---

## Part 3: Human-AI Partnership Case Studies

### Case Study #1: WSL Input Capture Lock

| Aspect | Details |
|--------|---------|
| **Symptom** | Theatre window unresponsive, mouse clicks delayed |
| **Diagnosis** | WSLg display server caching stale input state |
| **Fix** | Environment reset via `wsl --shutdown` |
| **Insight** | Agent recognized environmental issues that the human mistook for code bugs. |

### Case Study #2: Theatre Selection at Zero Size

| Aspect | Details |
|--------|---------|
| **Symptom** | Selection overlay rendered at near-zero size |
| **Diagnosis** | Type mismatch—Timeline sent object, Theatre expected string |
| **Fix** | Type normalization + scale safeguards in Layer.js |

```javascript
// Fix: Normalize to string regardless of source
const spriteName = typeof spriteNameOrObject === 'object' 
    ? spriteNameOrObject.name 
    : spriteNameOrObject;
```

### Case Study #3: Timeline Auto-Scrolling

| Aspect | Details |
|--------|---------|
| **Symptom** | Clicking keyframe caused erratic scrolling |
| **Diagnosis** | `scrollIntoView()` fired even for already-visible elements |
| **Fix** | Scroll origin tracking to distinguish click vs. external selection |

```javascript
// Fix: Track if the click originated in the timeline
const [clickOriginatedInTimeline, setClickOriginatedInTimeline] = useState(false);

useEffect(() => {
    if (selectedLayer !== null && !clickOriginatedInTimeline) {
        scrollToLayer(selectedLayer);
    }
    setClickOriginatedInTimeline(false);
}, [selectedLayer]);
```

---

## Part 4: The Partnership Framework

| Before (Manual Coder) | After (Thought Partner) |
|-----------------------|-------------------------|
| Read code to understand | Ask agent to summarize |
| Debug sequentially | Parallel exploration |
| Write tests as afterthought | Tests as thinking tool |
| Assume code bugs | Consider environment |
| Tolerate friction | Ask agent to fix tooling |

### The "Thought Partner" Workflow
1. **Articulate**: Describe what you want, not how to do it.
2. **Delegate**: Let the agent research, prototype, and propose.
3. **Verify**: Run tests, review changes, ask questions.
4. **Iterate**: Refine based on results.
5. **Document**: Agent generates docs, tests, and commit messages.

---

## Part 5: Tiered Validation & Smart Testing

To keep the feedback loop fast, we implemented a 4-tier validation system:

![Tiered Validation System](../assets/diagrams/tiered_validation.png)
*[Source: tiered_validation.dot](../assets/diagrams/tiered_validation.dot)*

### Usage
- **Fast**: Runs only tests affected by changed lines (LOC-based gating).
- **Medium**: Runs tests for modified files.
- **Full**: Pre-merge check with all tests and coverage.
- **Exhaustive**: Release-level deep analysis with parallel execution.

### Productivity Impact
| Scenario | Before | After |
|----------|--------|-------|
| Quick fix validation | 3 min | 5 sec (36x faster) |
| Pre-commit check | 5 min | 30 sec (10x faster) |
| Asset integrity | Manual QA | Automated (Caught in CI) |

---

## Part 4: Registered Agentic Workflows

The engine maintains a catalog of "Workflows" in `.agent/workflows/` that the agent can execute autonomously:

| Slash Command | Purpose |
|---------------|---------|
| `/validate` | Run tiered project validation |
| `/css-review` | Design system compliance audit |
| `/ux-review` | Accessibility and WCAG checks |
| `/security-review` | Secret scanning and dependency audit |
| `/add-scene` | Step-by-step scene creation guide |
| `/docs-path-integrity` | Verify relative paths in documentation |

---

## Conclusion: The Partnership Value Prop

The Papeterie Engine wasn't built by a human alone. It was built by a **human-AI team**:
- **Human**: Vision, judgment, taste, domain expertise.
- **Agent**: Speed, memory, parallel processing, tireless iteration.

By delegating the tedious parts—tracing data flows, writing boilerplate, and building infrastructure—we moved from "coding" to "architecting."

---

*Published: January 9, 2026*
