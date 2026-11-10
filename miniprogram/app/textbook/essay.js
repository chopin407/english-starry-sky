const content = require("./_generated/content");
const { essayDraftLimit, essayOpenings, gradeEssay } = require("../_generated/learning");

const scrollTop = () => wx.pageScrollTo({ scrollTop: 0, duration: 0 });

Page({
  data: { index: 0, practicing: false, draft: "", canSubmit: false, result: null, outlineHint: false, openingHint: false },
  onLoad({ book }) { this.setData({ essays: content[book]?.essays || [] }); },
  open(e) {
    const essay = this.data.essays[Number(e.currentTarget.dataset.index)];
    if (essay) this.setData({ essay, index: 0 });
  },
  version(e) { this.setData({ index: Number(e.currentTarget.dataset.index) }); },
  list() { this.setData({ essay: null }); },
  startPractice() {
    const { essay, index } = this.data;
    const version = essay?.versions[index];
    if (!version) return;
    const reference = version.paragraphs.join("\n\n");
    this.setData({
      practicing: true, draft: "", canSubmit: false, result: null, outlineHint: false, openingHint: false,
      openings: essayOpenings(version.paragraphs), limit: essayDraftLimit(reference),
    }, scrollTop);
  },
  exitPractice() { this.setData({ practicing: false, draft: "", result: null }, scrollTop); },
  toggleOutline() { this.setData({ outlineHint: !this.data.outlineHint }); },
  toggleOpenings() { this.setData({ openingHint: !this.data.openingHint }); },
  inputDraft(e) {
    const draft = e.detail.value;
    this.setData({ draft, canSubmit: !!draft.trim() });
  },
  submitPractice() {
    const { essay, index, draft, result } = this.data;
    if (!draft.trim() || result) return;
    const grade = gradeEssay(draft, essay.versions[index].paragraphs.join("\n\n"));
    const indexed = (parts) => parts.map((part, id) => ({ ...part, id }));
    this.setData({
      result: {
        ...grade, draft: indexed(grade.draft), reference: indexed(grade.reference),
        formatText: grade.formats.map((kind) => kind === "cap" ? "大小写" : "标点").join("和"),
      },
    }, scrollTop);
  },
  editPractice() { this.setData({ result: null }); },
});
