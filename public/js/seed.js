// البيانات الأولية: بتتحفظ في Firestore أوتوماتيك أول ما المالك ينشئ حسابه.
export const SEED_CATALOG = {
  settings: { whatsapp: "01062540279", vfcash: "01062540279", phones: ["01062540279", "01125842358", "01093973419"] },
  doctors: [
    { id: "d_hatem", name: "د. حاتم شلبي", specialty: "أطفال وغدد صماء وسكر واضطرابات النمو", title: "استشاري أول طب الأطفال والغدد الصماء والسكر واضطرابات النمو", bio: "استشاري أول بكلية الطب ومستشفى سوهاج الجامعي.\nلعلاج قصر القامة واضطرابات النمو، الغدد الصماء، والسكري عند الأطفال.", photo: "img/hatem.jpg", video: "", gallery: [] },
    { id: "d_safwat", name: "د. محمد صفوت الأقرع", specialty: "مخ وأعصاب وطب نفسي", title: "أخصائي أمراض المخ والأعصاب وأعصاب الأطفال والطب النفسي وعلاج الإدمان", bio: "أخصائي بمستشفى سوهاج العام الأميري.\nماجستير الأمراض العصبية والنفسية – كلية الطب جامعة أسيوط.", photo: "img/safwat.jpg", video: "", gallery: [] },
    { id: "d_ibrahim", name: "د. إبراهيم حمدي", specialty: "عظام ومفاصل وعمود فقري", title: "أخصائي جراحة العظام والمفاصل والعمود الفقري", bio: "", photo: "img/ibrahim.jpg", video: "", gallery: [] },
    { id: "d_nayaz", name: "د. أحمد عباس نياز", specialty: "أوعية دموية ودوالي وقدم سكري", title: "استشاري جراحة الأوعية الدموية والقسطرة الطرفية وعلاج دوالي الساقين والقدم السكري", bio: "استشاري بمستشفيات جامعة الأزهر.", photo: "img/nayaz.jpg", video: "", gallery: [] },
    { id: "d_abbas", name: "د. محمد عباس", specialty: "مسالك بولية وعقم وذكورة", title: "استشاري جراحة المسالك البولية والتناسلية وأمراض العقم والذكورة", bio: "استشاري بجامعة أسيوط.", photo: "img/abbas.jpg", video: "", gallery: [] }
  ],
  visits: [
    { id: "v_abbas_qft_1015", doctorId: "d_abbas", gov: "قنا", center: "قفط", date: "2026-10-15", time: "", fee: 0, note: "", status: "open" },
    { id: "v_nayaz_grg_1025", doctorId: "d_nayaz", gov: "سوهاج", center: "جرجا", date: "2026-10-25", time: "", fee: 0, note: "", status: "open" },
    { id: "v_hatem_qft_1026", doctorId: "d_hatem", gov: "قنا", center: "قفط", date: "2026-10-26", time: "", fee: 0, note: "", status: "open" },
    { id: "v_hatem_grg_1029", doctorId: "d_hatem", gov: "سوهاج", center: "جرجا", date: "2026-10-29", time: "", fee: 0, note: "", status: "open" },
    { id: "v_safwat_qft_1030", doctorId: "d_safwat", gov: "قنا", center: "قفط", date: "2026-10-30", time: "", fee: 0, note: "لأول مرة في قفط", status: "open" },
    { id: "v_ibrahim_qft_1031", doctorId: "d_ibrahim", gov: "قنا", center: "قفط", date: "2026-10-31", time: "", fee: 0, note: "", status: "open" }
  ],
  services: []
};
// بيانات داخلية مش بتظهر للمرضى: نسب الأطباء وتكلفة الخدمات
export const SEED_PRIVATE = { defaultShare: 50, shares: {}, costs: {} };
