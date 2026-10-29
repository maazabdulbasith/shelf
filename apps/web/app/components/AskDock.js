"use client";

import { thumbUrl } from "../lib/api";

export default function AskDock({ open, question, answer, asking, onToggle, onQuestion, onAsk }) {
  return (
    <aside className={open ? "ask open" : "ask"}>
      <button className="ask-toggle" type="button" onClick={onToggle} aria-expanded={open}>
        <span className="ask-mark" aria-hidden="true" />
        Ask the shelf
      </button>
      {open ? (
        <form
          className="ask-body"
          onSubmit={(event) => {
            event.preventDefault();
            onAsk();
          }}
        >
          <label className="sr" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            rows={3}
            placeholder="What was the nginx error?"
          />
          <div className="ask-row">
            <button className="chip primary" type="submit" disabled={asking || !question.trim()}>
              {asking ? "Looking" : "Ask"}
            </button>
            {answer?.engine ? <span className="engine">{answer.engine}</span> : null}
          </div>
          {answer ? <p className={answer.refused ? "answer refused" : "answer"}>{answer.answer}</p> : null}
          {answer?.citations?.length ? (
            <div className="cites">
              {answer.citations.map((cite) => (
                <figure className="cite" key={cite.id}>
                  <img src={thumbUrl(cite.id)} alt="" loading="lazy" decoding="async" />
                  <figcaption>{cite.filename}</figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </form>
      ) : null}
    </aside>
  );
}
