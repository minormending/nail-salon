import pathlib
import build as B

PROJ = pathlib.Path('/private/tmp/claude-502/-Users-kevinramdath-projects-nail-salon/a87466b9-bcd6-43ad-a280-db87cb5245c9/scratchpad/paisley/project')
ATTRS = 'fill="{{ink.fill}}" stroke="{{ink.stroke}}" stroke-width="{{ink.sw}}" stroke-dasharray="{{ink.dash}}"'

BUNTING = '''<svg width="390" height="54" viewBox="0 0 390 54" style="position: absolute; top: 0; left: 0; z-index: 2" aria-hidden="true">
      <path d="M 0 16 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 a 15 15 0 0 0 30 0 L 390 0 L 0 0 Z" fill="#F5A623"/>
      <g fill="#D81E5B">%s</g>
      <g fill="#0E8A6E">%s</g>
    </svg>''' % (
    "".join('<circle cx="%d" cy="32" r="4"/>' % (15 + 30 * i) for i in range(13)),
    "".join('<path d="M %d 40 L %d 40 L %d 54 Z"/>' % (30 + 60 * i, 44 + 60 * i, 37 + 60 * i) for i in range(6)))

SCALLOP = '<svg width="390" height="22" viewBox="0 0 390 22" style="flex: none; display: block; margin-bottom: -1px" aria-hidden="true"><path d="M 0 22 L 0 13 ' + 'a 13 13 0 0 1 26 0 ' * 15 + 'L 390 22 Z" fill="#D81E5B"/></svg>'

HTML = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Studio — Mela</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800&display=swap">
  <style>
    body {{ margin: 0; font-family: Nunito, system-ui, sans-serif; }}
    a {{ color: #D81E5B; }} a:hover {{ color: #A81444; }}
    button {{ font-family: inherit; cursor: pointer; }}
    .px-scroll::-webkit-scrollbar {{ height: 0; }}
  </style>
</helmet>

<div style="width: 390px; height: 844px; box-sizing: border-box; display: flex; flex-direction: column; background: #FFF3DC; color: #40163C; overflow: hidden">

  <div style="height: 44px; flex: none"></div>

  <header style="flex: none; height: 56px; display: flex; align-items: center; gap: 6px; padding: 0 14px">
    <div style="margin-right: auto">
      <h1 style="margin: 0; font-family: 'Baloo 2', Nunito, sans-serif; font-size: 25px; font-weight: 800; line-height: 1.05">Studio</h1>
      <a href="Rooms.dc.html" style="font-size: 11px; font-weight: 800; letter-spacing: 0.4px; text-decoration: none">&larr; THE SALON</a>
    </div>
    <button onClick="{{{{reset}}}}" aria-label="Undo" style="width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border: 2.5px solid #40163C; border-radius: 14px; background: #FFF3DC; color: #40163C">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 h11 a4.5 4.5 0 1 1 0 9 h-2.5"/><path d="M4 11 l4.5-4.5"/><path d="M4 11 l4.5 4.5"/></svg>
    </button>
    <button aria-label="Save a picture" style="width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; border: 2.5px solid #40163C; border-radius: 14px; background: #16A0BD; color: #FFF3DC">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 h3.2 L9 6.5 h6 l1.8 2 H20 v11 H4 Z"/><circle cx="12" cy="14" r="3.4"/></svg>
    </button>
  </header>

  <div style="flex: 1; position: relative; display: flex; align-items: flex-start; justify-content: center; min-height: 0; overflow: hidden; background: #FFE9C4">
    {bunting}
    <button onClick="{{{{ink.tap}}}}" style="position: absolute; top: 64px; right: 14px; z-index: 3; padding: 8px 14px; border-radius: 999px; border: 2.5px solid #40163C; background: {{{{ink.chip}}}}; font-size: 11px; font-weight: 800; letter-spacing: 0.3px; color: #40163C">{{{{ink.label}}}}</button>

    <svg viewBox="0 0 320 470" style="width: 318px; height: 467px" role="img" aria-label="A hand on a bright medallion, with a bold henna mandala and leafy vines down the fingers">
{svg}
    </svg>
  </div>

  {scallop}

  <div style="flex: none; padding: 6px 14px 20px; background: #D81E5B">
    <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 9px">
      <h2 style="margin: 0; font-family: 'Baloo 2', Nunito, sans-serif; font-size: 19px; font-weight: 800; color: #FFF3DC">Motifs</h2>
      <span style="font-size: 11px; font-weight: 800; color: #FFFFFF">{{{{ink.hint}}}}</span>
    </div>

    <div class="px-scroll" role="group" aria-label="Motifs" style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 12px; padding-bottom: 2px">
      <sc-for list="{{{{motifs}}}}" as="mo" hint-placeholder-count="5">
        <button onClick="{{{{mo.tap}}}}" style="flex: none; height: 48px; padding: 0 18px; border-radius: 14px; border: 2.5px solid #40163C; background: {{{{mo.bg}}}}; color: #40163C; font-size: 13.5px; font-weight: 800">{{{{mo.name}}}}</button>
      </sc-for>
    </div>

    <div role="group" aria-label="Tools" style="display: flex; gap: 7px; margin-bottom: 12px">
      <sc-for list="{{{{tools}}}}" as="tl" hint-placeholder-count="5">
        <button onClick="{{{{tl.tap}}}}" aria-label="{{{{tl.name}}}}" style="flex: 1; height: 52px; display: flex; align-items: center; justify-content: center; border: 2.5px solid #40163C; border-radius: 14px; background: {{{{tl.bg}}}}; color: #40163C">
          <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="{{{{tl.icon}}}}"/></svg>
        </button>
      </sc-for>
    </div>

    <button onClick="{{{{ink.tap}}}}" style="width: 100%; height: 56px; border: 2.5px solid #40163C; border-radius: 16px; background: #F5A623; color: #40163C; font-family: 'Baloo 2', Nunito, sans-serif; font-size: 18px; font-weight: 800">{{{{ink.cta}}}}</button>
  </div>
</div>
</x-dc>

<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":390,"height":844}}}}'>
class Component extends DCLogic {{
  constructor(props) {{
    super(props);
    this.state = {{ step: 4, tool: 'Cone', motif: 'Mandala' }};
  }}

  renderVals() {{
    // Step 0 is the not-yet-inked guide, 1..4 the four stain stages. The hand
    // is one set of paths; only the paint on the henna group changes.
    const fills = ['none', '#3B3326', '#D2691E', '#B2441C', '#9C3418'];
    const labels = ['NOT INKED YET', 'FRESH PASTE', '6 HOURS', '1 DAY \\u00b7 DEEPENING', '2 DAYS \\u00b7 RICHEST'];
    const chips = ['#FFF3DC', '#16A0BD', '#F5A623', '#F5A623', '#D81E5B'];
    const hints = ['trace it to start', 'it has to dry first', 'the orange comes up', 'darker every hour', 'as deep as it goes'];
    const ctas = ['Fill it all', 'Wait a while', 'Wait a while', 'Wait a while', 'Start again'];
    const step = this.state.step;
    const ghost = step === 0;

    const icons = {{
      Cone: 'M9 3 h6 l-2.2 13 h-1.6 Z',
      Stamp: 'M9 4 h6 v4.5 l2.4 4.5 H6.6 L9 8.5 Z',
      Mirror: 'M12 3 v18 M9.5 7.5 L4.5 12 l5 4.5 M14.5 7.5 L19.5 12 l-5 4.5',
      Jaali: 'M4 4 h16 v16 H4 Z M4 9.3 h16 M4 14.7 h16 M9.3 4 v16 M14.7 4 v16',
      Wipe: 'M7.5 17.5 L3.5 13.5 L12 5 l4 4 Z M8.5 20.5 h11'
    }};

    return {{
      ink: {{
        fill: fills[step],
        stroke: ghost ? '#B5855E' : 'none',
        sw: ghost ? 1.4 : 0,
        dash: ghost ? '3 3.5' : 'none',
        label: labels[step], chip: chips[step], hint: hints[step], cta: ctas[step],
        tap: () => this.setState({{ step: (step + 1) % 5 }})
      }},
      tools: ['Cone', 'Stamp', 'Mirror', 'Jaali', 'Wipe'].map((name) => ({{
        name: name, icon: icons[name],
        bg: this.state.tool === name ? '#F5A623' : '#FFF3DC',
        tap: () => this.setState({{ tool: name }})
      }})),
      motifs: ['Mandala', 'Paisley', 'Vine', 'Dots', 'Jaali'].map((name) => ({{
        name: name,
        bg: this.state.motif === name ? '#16A0BD' : '#FFF3DC',
        tap: () => this.setState({{ motif: name }})
      }})),
      reset: () => this.setState({{ step: 0 }})
    }};
  }}
}}
</script>
</body>
</html>
'''

(PROJ / 'MelaStudio.dc.html').write_text(
    HTML.format(bunting=BUNTING, scallop=SCALLOP, svg=B.inner(ATTRS)))
print('MelaStudio.dc.html', len((PROJ / 'MelaStudio.dc.html').read_text()), 'chars')
