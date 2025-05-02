import "./App.css";
import {
  type ChangeEventHandler,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";
import { socket } from "./socket.ts";
import vConsole from "vconsole";
import { debounce } from "lodash-es";
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
  const [wpm, setWpm] = useState(Number(localStorage.getItem("wpm") ?? 20));
  const [beeps, setBeeps] = useState<Beep[]>([]);
  const [beep, setBeep] = useState<Beep>();
  const [seq, setSeq] = useState<string[]>([]);
  const [words, setWords] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<
    Record<
      string,
      {
        words: Record<string, string>;
        wpm: number;
        callSign: string;
      }
    >
  >({});
  const [cwPlayer, setCwPlayer] = useState<HTMLAudioElement>();
  const [callSign, setCallSign] = useState<string>(
    localStorage.getItem("CallSign") ?? "CALLSIGN"
  );
  // const [play, setPlay] = useState<(e: MouseEvent | KeyboardEvent) => void>();
  // const [pause, setPause] = useState<(e: MouseEvent | KeyboardEvent) => void>();
  const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  const isTouch = "ontouchstart" in window;
  const unit = useMemo(() => 1.2 / wpm, [wpm]);
  const wordBreak = useMemo(() => 3.6 / wpm, [wpm]);

  useEffect(() => {
    console.log("App is mounted");
    window.oncontextmenu = () => false;
    window.onselectstart = () => false;
    const vconsole = new vConsole();

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
    const play = (e: MouseEvent | KeyboardEvent | TouchEvent) => {
      // console.log("play:", e?.which ?? e?.code);
      gap = beeps.length ? Math.min((+new Date() - ts) / 1000, 1) : 0;
      ts = +new Date();
      duration = 0;
      setBeeps([...beeps, { gap, duration, ts }]);
    };
    const padding = document.getElementById("padding") as HTMLDivElement;
    const pause = (e: MouseEvent | KeyboardEvent | TouchEvent) => {
      // console.log("pause:", e?.which ?? e?.code);
      duration = Math.min((+new Date() - ts) / 1000, 0.5);
      beeps.push({ gap, duration, ts });
      ts = +new Date();
      padding.style.borderLeftWidth = "0px";
      if (padding.clientWidth < 200) beeps.shift();
      if (duration < unit) {
        setTimeout(() => {
          setBeeps([...beeps]);
        }, (unit - duration) * 1000);
      } else {
        setBeeps([...beeps]);
      }
    };
    // setPlay(play);
    // setPause(pause);

    if (isMobile && isTouch) {
      window.ontouchstart = play;
      window.ontouchend = pause;
    } else {
      window.onmousedown = play;
      window.onmouseup = pause;
    }
    window.onkeydown = (e) => (e.code === "Space" ? play(e) : true);
    window.onkeyup = (e) => (e.code === "Space" ? pause(e) : true);

    return () => {
      setWords({});
      setBeeps([]);
    };
  }, [clear, unit]);

  useEffect(() => {
    function onConnect() {
      console.log("connected");
    }

    function onDisconnect() {
      console.log("disconnected");
    }
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(
      "message",
      (msg: {
        words: Record<string, string>;
        callSign: string;
        wpm: number;
      }) => {
        setMessages({ ...messages, [msg.callSign]: msg });
      }
    );
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

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
            if (tmpDuration > wordBreak) clearInterval(timer);
          }, 10)
        : 0;
    if (last) setBeep(last);
    return () => {
      setTmpDuration(0);
      clearInterval(timer);
    };
  }, [beeps, wordBreak]);

  useEffect(() => {
    // if (isMobile) return;
    if (beep?.duration === 0) {
      cwPlayer?.play();
    } else if (beep?.duration) {
      if (beep.duration < unit) {
        setTimeout(() => cwPlayer?.pause(), (unit - beep.duration) * 1000);
      } else {
        cwPlayer?.pause();
      }
    }
  }, [beep, cwPlayer, unit]);

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
      return;
    }
    return () => {};
  }, [seq]);

  const updateMessage = useCallback(
    debounce((data) => {
      socket.emit("message", data);
    }, unit * 7 * 1000),
    []
  );

  useEffect(() => {
    // console.log({ words, wpm, callSign });
    updateMessage({
      words,
      wpm,
      callSign,
    });
  }, [words, wpm, callSign]);

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
      {/* <button onMouseDown={(e) => play(e)}>Play</button> */}
      <div id="messages">
        我({callSign}): {wpm} WPM
        <br />
        <div className="message">
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
        {Object.entries(messages).map(([user, msg]) => {
          return (
            <div key={user}>
              <br />
              {msg.callSign}: {msg.wpm} WPM
              <br />
              <div className="message">
                {Object.entries(msg.words).map(([k, v]) => {
                  return (
                    <div key={k}>
                      {v}
                      <br />
                      {translate(v)}
                    </div>
                  );
                })}
              </div>
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
        CW / Morse Code 练习工具。使用鼠标或空格键触发，暂不支持自动键。
        连续六个滴清屏，bug反馈请联系 z@zt.vc
        <br />
        CW / Morse Code Playground. Use space or Mouse to play. automatic key is
        not supported yet. Bug report: z@zt.vc
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
      {/* <h1>CW Test</h1> */}
      {/* spped: {counter} */}
      {/* { cw} */}
      {/* <div>cw test</div> */}
      我的呼号(My CallSign):
      <input
        onChange={(e) => {
          console.log(e);
          const newCallSign = e.target.value.toUpperCase();
          localStorage.setItem("CallSign", newCallSign);
          setCallSign(newCallSign);
        }}
        size={10}
        value={callSign}
      />{" "}
      WPM:{" "}
      <select
        defaultValue={wpm}
        onChange={(e): ChangeEventHandler<HTMLSelectElement> | undefined => {
          const newWpm = Number(e.target.value);
          localStorage.setItem("wpm", newWpm.toFixed());
          setWpm(newWpm);
          return;
        }}
      >
        <option value={12}>12</option>
        <option value={15}>15</option>
        <option value={20}>20</option>
        <option value={24}>24</option>
        <option value={30}>30</option>
      </select>
    </div>
  );
};

export default App;
