import { EventEmitter } from "events";
import { MessageReaction, MessageEmbed, Message, User, Emoji, TextChannel, DMChannel } from 'discord.js';

type ReactionHandler = 
    (m : MessageReaction, i : number, u : User, e : MessageEmbed[], c : ReturnType<Message['createReactionCollector']>) => 
        { index?: number, embed?: MessageEmbed[] }

const deURIfy = (s : string) => decodeURIComponent(s);

export class PagedEmbeds extends EventEmitter {
    private _embeds : MessageEmbed[] = []
    private _msg: Message
    private _channel: Message['channel'];
    private _filter: Parameters<Message['createReactionCollector']>[0]
    private _currentIndex = 0;
    private _hooks = new Map<string, [Emoji | String, ReactionHandler]>()

    constructor() {
        super();
    }

    public setEmbeds(m : MessageEmbed[]) {
        if (!Array.isArray(m)) throw new TypeError(`Argument to setEmbeds must be an array of MessageEmbeds!`)
        this._embeds = m
        return this;
    }

    public setChannel(c: Message['channel']) {
        this._channel = c;
        return this;
    }

    public addHandler(e : Emoji | String, h : ReactionHandler) {
        this._hooks.set(deURIfy(e.toString()), [e, h]);
        return this;
    }

    public removeHandler(e : Emoji) {
        this._hooks.delete(deURIfy(e.toString()));
        return this;
    }

    public setIndex(i : number) {
        if (typeof i !== 'number') throw new TypeError(`Argument to setIndex must be a number!`)
        this._currentIndex = i; return this;
    }

    get hooks() { return this._hooks };

    public async run(opts : Parameters<Message['createReactionCollector']>[1]) {
        const content = '';
        if (!this._channel) throw new Error(`A channel must be set!`)
        this._msg = await this._channel.send(content, this._embeds[this._currentIndex]);
        let collector = this._msg.createReactionCollector(
            (r : MessageReaction) => this._hooks.has(deURIfy(r.emoji.toString())),
            opts
        );
        collector.on('collect', (r, u) => {
            if (u.id === this._msg.author.id) return;

            let { index, embed } = this._hooks.get(deURIfy(r.emoji.toString()))[1](
                r, this._currentIndex, u, this._embeds, collector
            )
            if (!embed) embed = this._embeds;
            if (!index)
                if (typeof index !== 'number')
                    // in case 0 is passed, still count
                    index = ((this._currentIndex + 1) % embed.length + embed.length) % embed.length;
            this._currentIndex = index; this._embeds = embed;
            
            this._msg.edit(content, { embed: embed[index] });
        })
        this._hooks.forEach(([e]) => this._msg.react(e.toString()));
        return collector;
    }
}
