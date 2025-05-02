import "./App.css";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
// import cw from 'cw/dist/cw.esm';
type Beep = {
  ts: number;
  duration: number;
  gap: number;
};

const textToMorseMap = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  "0": "-----",
  " ": "/",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  '"': ".-..-.",
  "@": ".--.-.",
};
// morse code map
const MorseCodeMap = new Map([
  ["-----", "0"],
  [".----", "1"],
  ["..---", "2"],
  ["...--", "3"],
  ["....-", "4"],
  [".....", "5"],
  ["-....", "6"],
  ["--...", "7"],
  ["---..", "8"],
  ["----.", "9"],
  [".-", "A"],
  ["-...", "B"],
  ["-.-.", "C"],
  ["-..", "D"],
  [".", "E"],
  ["..-.", "F"],
  ["--.", "G"],
  ["....", "H"],
  ["..", "I"],
  [".---", "J"],
  ["-.-", "K"],
  [".-..", "L"],
  ["--", "M"],
  ["-.", "N"],
  ["---", "O"],
  [".--.", "P"],
  ["--.-", "Q"],
  [".-.", "R"],
  ["...", "S"],
  ["-", "T"],
  ["..-", "U"],
  ["...-", "V"],
  [".--", "W"],
  ["-..-", "X"],
  ["-.--", "Y"],
  ["--..", "Z"],
  ["/", " "],
  [".-.-.-", "."],
  ["--..--", ","],
  ["..--..", "?"],
  ["-.-.--", "!"],
  ["-..-.", "/"],
  ["-.--.", "("],
  ["-.--.-", ")"],
  [".-...", "&"],
  ["---...", ":"],
  ["-...-", "="],
  [".-.-.", "+"],
  ["-....-", "-"],
  [".-..-.", '"'],
  [".--.-.", "@"],
]);
const translate = (code: string) => {
  return MorseCodeMap.get(code);
};
function CreateWav(frequency = 600, durationSeconds = 60) {
  const sampleRate = 8000;
  const numChannels = 1;
  const bytesPerSample = 2 * numChannels;
  const bytesPerSecond = sampleRate * bytesPerSample;
  const dataLength = bytesPerSecond * durationSeconds;
  const headerLength = 44;
  const fileLength = dataLength + headerLength;
  const bufferData = new Uint8Array(fileLength);
  const dataView = new DataView(bufferData.buffer);
  const writer = createWriter(dataView);
  // HEADER
  writer.string("RIFF");
  // File Size
  writer.uint32(fileLength);
  writer.string("WAVE");
  writer.string("fmt ");
  // Chunk Size
  writer.uint32(16);
  // Format Tag
  writer.uint16(1);
  // Number Channels
  writer.uint16(numChannels);
  // Sample Rate
  writer.uint32(sampleRate);
  // Bytes Per Second
  writer.uint32(bytesPerSecond);
  // Bytes Per Sample
  writer.uint16(bytesPerSample);
  // Bits Per Sample
  writer.uint16(bytesPerSample * 8);
  writer.string("data");
  writer.uint32(dataLength);
  for (let i = 0; i < dataLength / 2; i++) {
    const t = i / sampleRate;
    const volume = 0.5;
    const val = Math.sin(2 * Math.PI * frequency * t) * volume;
    writer.pcm16s(val);
  }
  const blob = new Blob([dataView.buffer], {
    type: "application/octet-stream",
  });
  return blob;
}
function createWriter(dataView: DataView) {
  let pos = 0;
  return {
    string(val: string) {
      for (let i = 0; i < val.length; i++) {
        dataView.setUint8(pos++, val.charCodeAt(i));
      }
    },
    uint16(val: number) {
      dataView.setUint16(pos, val, true);
      pos += 2;
    },
    uint32(val: number) {
      dataView.setUint32(pos, val, true);
      pos += 4;
    },
    pcm16s: (value: number) => {
      let val = Math.round(value * 32768);
      val = Math.max(-32768, Math.min(val, 32767));
      dataView.setInt16(pos, val, true);
      pos += 2;
    },
  };
}
const App = () => {
  const [clear, setClear] = useState(0);
  const [tmpDuration, setTmpDuration] = useState(0);
  const [wpm, setWpm] = useState(20);
  const [beeps, setBeeps] = useState<Beep[]>([]);
  const [beep, setBeep] = useState<Beep>();
  const [seq, setSeq] = useState<string[]>([]);
  const [words, setWords] = useState<Record<string, string>>({});
  const [cwPlayer, setCwPlayer] = useState<HTMLAudioElement>();
  useEffect(() => {
    console.log("App is mounted");
    window.oncontextmenu = () => false;
    window.onselectstart = () => false;

    if (!clear) {
      const cwPlayer = window.document.getElementById(
        "cwPlayer"
      ) as HTMLAudioElement;
      cwPlayer.src = URL.createObjectURL(CreateWav(600, 600));
      setCwPlayer(cwPlayer);
      window.document.title = "CW Test";
    }
    let ts = +new Date();
    let duration = 0;
    let gap = 0;
    const beeps: Beep[] = [];
    const play = (e: MouseEvent | KeyboardEvent) => {
      console.log("play:", e.which ?? e.code);
      gap = beeps.length ? Math.min((+new Date() - ts) / 1000, 1) : 0;
      ts = +new Date();
      duration = 0;
      setBeeps([...beeps, { gap, duration, ts }]);
    };
    const padding = document.getElementById("padding") as HTMLDivElement;
    const pause = (e: MouseEvent | KeyboardEvent) => {
      console.log("pause:", e.which ?? e.code);
      duration = Math.min((+new Date() - ts) / 1000, 0.5);
      beeps.push({ gap, duration, ts });
      ts = +new Date();
      padding.style.borderLeftWidth = "0px";
      if (padding.clientWidth < 300) beeps.shift();
      setBeeps([...beeps]);
    };

    window.onmousedown = play;
    window.onmouseup = pause;
    // window.ontouchstart = play;
    // window.ontouchend = pause;
    window.onkeydown = (e) => e.code === "Space" && play(e);
    window.onkeyup = (e) => e.code === "Space" && pause(e);
    const socket = io("/cw", {
      autoConnect: true,
    });
    socket.on("message", (words) => {
      console.log("words:", words);
    });
    socket.connect();
    return () => {
      setWords({});
      setBeeps([]);
      socket.disconnect();
    };
  }, [clear]);

  useEffect(() => {
    console.log("wpm changed to", wpm);
  }, [wpm]);

  useEffect(() => {
    const last = beeps.slice(-1).pop();
    const ts = +new Date();
    const timer =
      last?.duration === 0
        ? setInterval(() => {
            const tmpDuration = (+new Date() - ts) / 1000;
            setTmpDuration(tmpDuration);
            if (tmpDuration > 0.5) clearInterval(timer);
          }, 10)
        : 0;
    if (last) setBeep(last);
    return () => {
      setTmpDuration(0);
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [beeps]);

  useEffect(() => {
    if (beep?.duration === 0) {
      cwPlayer?.play();
    } else if (beep?.duration) {
      if (beep.duration < 0.1) {
        setTimeout(() => cwPlayer?.pause(), 0.1);
      } else {
        cwPlayer?.pause();
      }
    }
  }, [beep, cwPlayer]);

  const unit = 0.07;
  const wordBreak = unit * 3;

  useEffect(() => {
    const last6 = beeps.slice(-6);
    // console.log(last6);
    const seq: string[] = [];
    let ts = 0;
    for (let i = last6.length; i > 0; i -= 1) {
      const beep = last6[i - 1];
      seq.unshift(beep.duration < wordBreak ? "." : "-");
      ts = beep.ts;
      if (beep.gap > wordBreak) {
        break;
      }
    }
    // console.log(seq);
    setSeq(seq);
    if (seq.length) setWords({ ...words, [ts]: seq.join("") });
    return () => {};
  }, [beeps, wordBreak]);

  useEffect(() => {
    if (seq.join("") === "......") {
      setTimeout(() => {
        setClear(+new Date());
      }, 200);
    }
  }, [seq]);

  // useEffect(() => {
  // console.table(words);
  // }, [words]);

  return (
    <div className="content">
      <div id="chart">
        {beeps.map((b: Beep) => {
          return (
            <div
              key={b.ts.toString()}
              style={{
                width: b.duration * 100,
                marginLeft: b.gap * 100,
              }}
            />
          );
        })}
        <div
          id="padding"
          style={{
            borderLeftWidth: tmpDuration * 100,
            borderLeftColor: "#ccc",
            borderLeftStyle: "solid",
          }}
        />
      </div>
      <div id="input">
        {Object.entries(words).map(([k, v]) => {
          return (
            <div key={k}>
              {v}
              <br />
              {translate(v)}
            </div>
          );
        })}
      </div>
      <hr />
      <div id="codes">
        {Object.entries(textToMorseMap).map(([k, v]) => {
          return (
            <div key={k}>
              {k}
              <br />
              {v}
            </div>
          );
        })}
      </div>
      <div className="help">
        CW 通信 Morse Code 练习工具。使用鼠标或空格键触发，暂不支持自动键。
        连续六个滴清屏，bug反馈请联系 z@zt.vc
      </div>
      {/* <audio
          controls={true}
          autoPlay={false}
          loop={true}
          id="diPlayer"
          src=""
        />
        <audio controls={true} autoPlay={false} id="dahPlayer" src="" loop />
        <br /> */}
      <br />
      <audio controls={false} autoPlay={false} id="cwPlayer" loop />
      {/* WPM:{" "}
      <select
        defaultValue={wpm}
        onChange={(e): ChangeEventHandler<HTMLSelectElement> | undefined => {
          setWpm(Number(e.target.value));
          return;
        }}
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={15}>15</option>
        <option value={20}>20</option>
        <option value={25}>25</option>
        <option value={30}>30</option>
      </select> */}
      {/* <h1>CW Test</h1> */}
      {/* spped: {counter} */}
      {/* { cw} */}
      {/* <div>cw test</div> */}
    </div>
  );
};

export default App;
