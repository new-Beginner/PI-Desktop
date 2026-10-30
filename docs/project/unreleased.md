# Unreleased changes

- Refine autonomous Goal: one Goal budget row in Settings → AI with turn/token
  inputs (non-cap values normalize to Unlimited on blur/Enter), compact height,
  silent autosave and no helper/validation text, switches or advanced row. Inset
  the Goal header behind Composer while retaining the original rounded input edge;
  use `00h00m00s`, circle-ellipsis Details and one bottom Close in removal confirmation.
  TaskDock is hidden without deleting AI todos; deletion restores it. Edit pauses first and stays paused after save;
  deletion preserves chat/tasks and safe late settlement. New completion reports
  require the current model's full-scope audit, not independent host proof.
  Existing permissions, finite budgets, historical approvals and restart pause remain.

- Add OpenAI Fast mode (#1657). Allow it per model in Settings → Models for a
  ChatGPT subscription or an OpenAI Responses connection, then type `/fast` to
  turn it on for the current conversation. Requests ask for the priority
  service tier, which replies faster and spends plan limits faster or bills
  more per token; the Composer model chip shows a Fast mark while it is on.
- Fixed an older regenerated prompt appearing after the latest reply when its
  branch archive completed outside the loaded history window (#1870). Pager
  acknowledgements now update existing rows without appending historical roots.
- Generate inline visualizations faster. The visualization shell now preloads
  the bundled D3 and a `viz` chart helper layer (container sizing, resize and
  theme redraw, axes, tick overlap, legends, and a declarative `viz.render`
  for bar, line, area, point, heatmap, and donut charts), so model-written
  fragments are shorter. The `visualize` skill asks for a single write
  followed by the reply instead of reading the file back. Fragments written
  under the earlier skill keep rendering. When a fragment's script fails, the
  card now says so and shows the error instead of staying blank, and the
  model's write result flags syntax errors and missing chart containers so it
  can fix them with one edit.
