import "./_brand.css";
import { brandMark } from "./assets";

const colors = [{ name:"Midnight", hex:"#0A182B", role:"Foundation" },{ name:"Action Blue", hex:"#2C8AF2", role:"Live guidance" },{ name:"Human Coral", hex:"#F5695D", role:"Presence cue" },{ name:"Signal Fog", hex:"#EDF3F8", role:"Working surface" }];

export function BrandSystem() {
  return <main className="tg-brand"><div className="tg-brand-stage">
    <header className="tg-head"><div><div className="tg-kicker">Tradigo / identity system 01</div><h1>Trade with <em>Guidance.</em></h1></div><p>A visual language for the moment a real trader meets a real coach — precise enough for a dashboard, warm enough for a human conversation.</p></header>
    <section className="tg-panel" style={{padding:"clamp(1.3rem,4vw,3rem)"}} aria-labelledby="system-title">
      <div style={{display:"flex",justifyContent:"space-between",gap:"1rem",alignItems:"end",borderBottom:"1px solid var(--line)",paddingBottom:"1.3rem"}}><div><div className="tg-label">The signal model</div><h2 id="system-title" style={{font:"600 clamp(1.4rem,3vw,2.4rem) var(--font-serif)",letterSpacing:"-.05em",margin:".45rem 0 0"}}>One point. Two people. Live clarity.</h2></div><div className="tg-mono" style={{fontSize:".65rem",color:"#6b7e90"}}>TG / 001</div></div>
      <div className="tg-grid" style={{gridTemplateColumns:"1.25fr .75fr",marginTop:"2rem"}}>
         <div style={{padding:"clamp(1.5rem,5vw,4rem)",borderRadius:"1rem",background:"var(--midnight)",color:"white",minHeight:"18rem",display:"flex",flexDirection:"column",justifyContent:"space-between"}}><img className="tg-mark" src={brandMark("live-point-signal.svg")} alt="Live Point Signal mark" /><div><div style={{font:"600 2rem var(--font-serif)",letterSpacing:"-.06em"}}>Guidance, in the room.</div><p className="tg-footnote" style={{color:"#aabacc",maxWidth:"24rem",marginTop:".7rem"}}>Blue is the action. Coral is the person. Midnight gives every decision room to breathe.</p></div></div>
        <div style={{display:"grid",gap:".6rem"}}>{colors.map(c=><div key={c.name} style={{display:"grid",gridTemplateColumns:"3.5rem 1fr",gap:".75rem",alignItems:"center",padding:".65rem",borderBottom:"1px solid var(--line)"}}><div style={{height:"3.5rem",borderRadius:".55rem",background:c.hex,border:c.name==="Signal Fog"?"1px solid var(--line)":"none"}}/><div><strong style={{fontSize:".78rem"}}>{c.name}</strong><div className="tg-mono" style={{fontSize:".65rem",color:"#6b7e90"}}>{c.hex} · {c.role}</div></div></div>)}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:".7rem",marginTop:"1.8rem"}} className="tg-grid"><div className="tg-contrast"><span className="tg-dot" /> Coral cue · AA on Midnight</div><div className="tg-contrast"><span className="tg-dot" style={{background:"var(--blue)"}} /> Blue action · AA on Midnight</div><div className="tg-contrast"><span className="tg-dot" style={{background:"var(--midnight)"}} /> Midnight text · AAA on Fog</div></div>
    </section>
  </div></main>;
}
export default BrandSystem;