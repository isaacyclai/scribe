import React from 'react'

export default function AboutPage() {
    return (
        <div className="mx-auto max-w-4xl py-12">
            <h1 className="mb-6 text-3xl font-bold text-zinc-900">About</h1>
            <div className="mb-6 prose prose-zinc max-w-none rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
                <p className="text-zinc-600">
                    Scribe was born out of a desire to make it easier for the general public to keep up with what's happening in
                    Singapore's Parliament. Despite the Hansard being publicly available, the format of the official reports can be
                    rather unwieldy for sifting through, and it is my hope that this site will provide a cleaner, more modern interface
                    to access the information they contain.
                </p>
                <p className="text-zinc-600">
                    Scribe is an independent project and is not affiliated with the Singapore Government in any way. It is open
                    sourced under the MIT license, and the code is available on <a href="https://github.com/isaacyclai/scribe" className="underline hover:text-blue-600" target="_blank" rel="noreferrer">GitHub</a>.
                    If you have any feedback, suggestions, or bug reports, please feel free to open an issue on the GitHub repository or <a href="mailto:isaac.yc.lai@gmail.com" className="underline hover:text-blue-600" target="_blank" rel="noreferrer">email</a> me.
                </p>
            </div>

            <h1 className="mb-6 text-3xl font-bold text-zinc-900">Acknowledgements</h1>
            <div className="prose prose-zinc max-w-none rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
                <p className="text-zinc-600">
                    All data on parliamentary proceedings is sourced from the official <a href="https://sprs.parl.gov.sg/search/#/home" className="underline hover:text-blue-600" target="_blank" rel="noreferrer">Hansard</a>,
                    whose copyright is owned by the Singapore Government. Additional information about the structure of Parliament is
                    sourced from the official <a href="https://www.parliament.gov.sg/" className="underline hover:text-blue-600" target="_blank" rel="noreferrer">Parliament of Singapore</a> website.
                </p>
                <p className="text-zinc-600">
                    This project is inspired by <a href="https://telescope.gov.sg/" className="underline hover:text-blue-600" target="_blank" rel="noreferrer">Telescope</a> and <a href="https://search.pair.gov.sg/" className="underline hover:text-blue-600" target="_blank" rel="noreferrer">Pair Search</a>.
                    While my goal in creating this site was to make it easier to read official sitting reports from the Hansard,
                    in some sense this project is also an expansion of Telescope beyond just PQs, so I'm grateful to its creators for
                    the ideas it provided when it came to aggregating and structuring the data.
                </p>
            </div>
        </div>

    )
}
