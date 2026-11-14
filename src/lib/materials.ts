import {supabase} from './supabase'
import {db} from './db'
export async function publishGeneratedMaterial(
 documentId:string,
 title:string,
 pageCount:number,
 options:{shareOriginal?:boolean;sourceDocumentId?:string}={},
):Promise<string>{
 if(!supabase)throw new Error('Sign in and connect the shared library before publishing.')
 const{data:auth,error:authError}=await supabase.auth.getUser()
 if(authError||!auth.user)throw new Error('Sign in before publishing study material.')
 const[note,keyPoints,orgs,deck]=await Promise.all([db.notes.where('documentId').equals(documentId).first(),db.keyPoints.where('documentId').equals(documentId).sortBy('position'),db.orgs.where('documentId').equals(documentId).toArray(),db.decks.where('documentId').equals(documentId).first()])
 const[cards,questions,profile]=await Promise.all([deck?db.cards.where('deckId').equals(deck.id).toArray():Promise.resolve([]),deck?db.questions.where('deckId').equals(deck.id).toArray():Promise.resolve([]),db.profile.get('me')])
 const user=auth.user;const authorName=String(profile?.displayName||user.user_metadata?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Student').slice(0,80)
 const shareOriginal=Boolean(options.shareOriginal&&options.sourceDocumentId)
 if(options.shareOriginal&&!options.sourceDocumentId)throw new Error('The original PDF is not available in private cloud storage, so it cannot be shared yet.')
 const content={summary:note?.summary??'',takeaways:note?.takeaways??[],keyPoints:keyPoints.map(({heading,body,example,page,tags})=>({heading,body,example,page,tags})),organizations:orgs.map(({name,kind,url,why,verified})=>({name,kind,url,why,verified})),flashcards:cards.map(({front,back,example,page,tags})=>({front,back,example,page,tags})),questions:questions.map(({stem,options,answerIndex,explanation,page})=>({stem,options,answerIndex,explanation,page}))}
 const tags=[...new Set(keyPoints.flatMap(point=>point.tags??[]).map(tag=>String(tag).slice(0,32)))].slice(0,12)
 const{data,error}=await supabase.from('public_materials').insert({owner_id:user.id,author_name:authorName,title:title.slice(0,200),discipline:profile?.department?.slice(0,100)||'General',page_count:pageCount,tags,summary:String(note?.summary??'').slice(0,12000),content,is_public:true,share_original:shareOriginal,source_document_id:shareOriginal?options.sourceDocumentId:null}).select('id').single()
 if(error||!data)throw error??new Error('The public material could not be saved.')
 return data.id as string
}
