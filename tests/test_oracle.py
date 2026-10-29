"""T04 truth tests include an intentionally separate itertools product oracle in tests."""

import itertools
import json
import random
from pathlib import Path

import pytest
from pydantic import ValidationError

from joinwitness.baseline import ReferenceDraft, freeze_reference
from joinwitness.contracts import InputBundle
from joinwitness.ingest import load_csv_bytes, load_pair
from joinwitness.oracle import OracleResult, _counts, enumerate_oracle
from joinwitness.policy import ReviewDraft, ReviewedEdge, UnmatchedRule, PolicyError, PolicyCode, freeze_review

ROOT = Path(__file__).resolve().parents[1] / 'fixtures'


def load_case(name):
    root = ROOT / name
    bundle = load_pair(root / 'registrations.csv', root / 'attendance.csv')
    draft = ReviewDraft.model_validate_json((root / 'review_policy.json').read_bytes())
    snapshot = freeze_review(bundle, draft)
    reference, baseline = freeze_reference(bundle, snapshot, ReferenceDraft.model_validate_json((root / 'reference.json').read_bytes()))
    return bundle, draft, snapshot, reference, baseline


@pytest.mark.parametrize('name,a,b,rev,min_distance,possible', [
    ('flagship_flip',2,1,True,1,2),
    ('stable',2,1,True,None,1),
    ('two_changes',4,1,True,2,4),
    ('tie',2,1,True,1,2),
    ('false_reference',1,2,False,1,2),
])
def test_complete_named_fixtures(name,a,b,rev,min_distance,possible):
    bun,draft,snap,ref,_=load_case(name)
    result=enumerate_oracle(bun,snap,ref)
    assert result.baseline_counts.a == a and result.baseline_counts.b == b
    assert result.baseline_counts.a_greater_than_b is rev
    assert result.reason == 'COMPLETE_ENUMERATION'
    assert result.enumerated_feasible_assignments == possible
    assert result.minimum_changed_assignments == min_distance
    assert (result.status=='ORACLE_REVERSIBLE') is (min_distance is not None)
    assert result.reference_sha256 == ref.reference_sha256
    assert result.review_sha256 == snap.snapshot_sha256
    assert result.independent_checker_status=='NOT_RUN_T06'
    assert result.solver_status=='NOT_RUN_T05'
    if min_distance is None:
        assert result.alternative_assignments is None and result.alternative_counts is None
    else:
        assert result.alternative_counts.a_greater_than_b is (not rev)
        assert len(result.alternative_assignments)==len(bun.attendance)


def test_flagship_exact_counterexample_and_minimality():
    bun,_,snap,ref,_=load_case('flagship_flip')
    r=enumerate_oracle(bun,snap,ref)
    assert r.alternative_assignments==(('T-01','R-A1'),('T-02','R-B2'),('T-03','R-B1'))
    assert (r.alternative_counts.a,r.alternative_counts.b)==(1,2)
    assert r.minimum_changed_assignments == 1
    assert r.combination_upper_bound == 2


def test_tie_explicitly_false_and_unmatched_not_counted():
    bun,_,snap,ref,_=load_case('tie')
    result=enumerate_oracle(bun,snap,ref)
    assert result.alternative_counts.a==result.alternative_counts.b==1
    assert result.alternative_counts.unmatched==1
    assert not result.alternative_counts.a_greater_than_b
    assert ('T-02',None) in result.alternative_assignments


def test_two_changes_one_change_does_not_flip():
    bun,_,snap,ref,_=load_case('two_changes')
    result=enumerate_oracle(bun,snap,ref)
    assert result.minimum_changed_assignments==2
    assert (result.alternative_counts.a,result.alternative_counts.b)==(2,3)


def test_allowed_unmatched_has_neither_group():
    bun,draft,snap,ref,_=load_case('flagship_flip')
    rules=tuple(x.model_copy(update={'status':'ALLOWED'}) if x.attendance_id=='T-02' else x for x in draft.unmatched)
    ss=freeze_review(bun,draft.model_copy(update={'revision':2,'unmatched':rules}))
    rr,_=freeze_reference(bun,ss,ReferenceDraft(assignments=ref.assignments))
    result=enumerate_oracle(bun,ss,rr)
    assert result.status=='ORACLE_REVERSIBLE'
    assert result.minimum_changed_assignments==1
    assert result.enumerated_feasible_assignments==3


def test_required_unmatched_has_single_choice_and_no_reversal():
    bun,draft,_,_,_=load_case('flagship_flip')
    d=draft.model_copy(update={'revision':2,
      'edges':tuple(e for e in draft.edges if e.attendance_id!='T-02'),
      'unmatched':tuple(u.model_copy(update={'status':'REQUIRED'}) if u.attendance_id=='T-02' else u for u in draft.unmatched)})
    snap=freeze_review(bun,d)
    ref,_=freeze_reference(bun,snap,ReferenceDraft(assignments=(
      {'attendance_id':'T-01','registration_id':'R-A1'},
      {'attendance_id':'T-02','registration_id':None},
      {'attendance_id':'T-03','registration_id':'R-B1'})))
    result=enumerate_oracle(bun,snap,ref)
    assert result.status=='ORACLE_STABLE'
    assert result.baseline_counts.unmatched==1


def test_combination_limit_not_false_stable():
    bun,_,snap,ref,_=load_case('flagship_flip')
    r=enumerate_oracle(bun,snap,ref,max_combinations=1)
    assert r.status=='NOT_VERIFIED' and r.reason=='COMBINATION_LIMIT'
    assert r.enumerated_feasible_assignments==0
    assert r.minimum_changed_assignments is None and r.alternative_counts is None
    assert enumerate_oracle(bun,snap,ref,max_combinations=2).minimum_changed_assignments==1


def test_row_limit_not_false_stable():
    # 13 forced unmatched rows, still a complete valid baseline: blocked solely on size.
    attendees='attendance_id,recorded_name\n'+''.join(f'T-{i},Person {i}\n' for i in range(13))
    regs=b'registration_id,name,group\nR1,Person,A\n'
    rr,rd=load_csv_bytes(regs,'registrations')
    aa,ad=load_csv_bytes(attendees.encode(),'attendance')
    b=InputBundle(registrations=rr,registrations_digest=rd,attendance=aa,attendance_digest=ad)
    d=ReviewDraft(revision=1,edges=(),unmatched=tuple(UnmatchedRule(attendance_id=f'T-{i}',status='REQUIRED') for i in range(13)),
         coverage='REVIEWED_PARTIAL',scope_note='Synthetic forced unmatched test for size limitation.')
    s=freeze_review(b,d)
    ref,_=freeze_reference(b,s,ReferenceDraft(assignments=tuple({'attendance_id':f'T-{i}','registration_id':None} for i in range(13))))
    o=enumerate_oracle(b,s,ref)
    assert o.status=='NOT_VERIFIED' and o.reason=='ROW_LIMIT'
    assert o.combination_upper_bound==1 and o.enumerated_feasible_assignments==0


@pytest.mark.parametrize('max_rows,max_combinations',[(0,10),(13,10),(3,0),(3,250001),(True,5),(3,False)])
def test_invalid_limits_rejected(max_rows,max_combinations):
    bun,_,snap,ref,_=load_case('flagship_flip')
    with pytest.raises(ValueError):
        enumerate_oracle(bun,snap,ref,max_rows=max_rows,max_combinations=max_combinations)


def test_stale_policy_refused_before_enumeration():
    bun,d,s,ref,_=load_case('flagship_flip')
    newer=freeze_review(bun,d.model_copy(update={'revision':2}))
    from joinwitness.baseline import BaselineError,BaselineCode
    with pytest.raises(BaselineError) as err:
        enumerate_oracle(bun,newer,ref)
    assert err.value.code==BaselineCode.STALE


def test_tampered_reference_refused_before_enumeration():
    bun,_,snap,ref,_=load_case('flagship_flip')
    bad=ref.model_copy(update={'assignments':ref.assignments[:-1]})
    from joinwitness.baseline import BaselineError,BaselineCode
    with pytest.raises(BaselineError) as err:
        enumerate_oracle(bun,snap,bad)
    assert err.value.code==BaselineCode.INVALID


def test_tampered_review_refused_before_enumeration():
    bun,_,snap,ref,_=load_case('flagship_flip')
    bad=snap.model_copy(update={'coverage':'UNREVIEWED'})
    with pytest.raises(PolicyError) as err:
        enumerate_oracle(bun,bad,ref)
    assert err.value.code==PolicyCode.SNAPSHOT_INVALID


def test_oracle_result_is_strict_and_frozen():
    bun,_,snap,ref,_=load_case('flagship_flip')
    result=enumerate_oracle(bun,snap,ref)
    with pytest.raises(ValidationError):result.status='ORACLE_STABLE'
    with pytest.raises(ValidationError): OracleResult.model_validate({**result.model_dump(),'anything':1})


def test_oracle_core_does_not_import_solver_or_t03_choice_helper():
    import inspect
    from joinwitness import oracle
    text=inspect.getsource(oracle)
    assert 'from .solver' not in text
    assert 'from .checker' not in text
    assert 'allowed_choices(' not in text
    assert '_check_choices(' not in text


def test_reg_collision_excluded_independently():
    bun,d,_,_,_=load_case('flagship_flip')
    # Add R-A1 as a candidate for T-02; illegal collision must not be counted.
    e=ReviewedEdge(attendance_id='T-02',registration_id='R-A1',status='POSSIBLE')
    s=freeze_review(bun,d.model_copy(update={'revision':2,'edges':d.edges+(e,)}))
    original=ReferenceDraft.model_validate_json((ROOT/'flagship_flip'/'reference.json').read_bytes())
    r,_=freeze_reference(bun,s,original)
    o=enumerate_oracle(bun,s,r)
    assert o.combination_upper_bound==3 and o.enumerated_feasible_assignments==2
    assert o.minimum_changed_assignments==1


def test_partial_scope_qualified_even_on_stable_case():
    bun,d,_,ref,_=load_case('stable')
    s=freeze_review(bun,d.model_copy(update={'coverage':'REVIEWED_PARTIAL','closed_scope_attested':False}))
    r,_=freeze_reference(bun,s,ReferenceDraft(assignments=ref.assignments))
    o=enumerate_oracle(bun,s,r)
    assert o.status=='ORACLE_STABLE' and o.coverage=='REVIEWED_PARTIAL'
    assert 'does not prove real identities' in o.scope_caveat


def test_oracle_cli_command(capsys):
    from joinwitness.oracle import main
    import sys
    f=ROOT/'flagship_flip'
    args=['oracle','--registrations',str(f/'registrations.csv'),'--attendance',str(f/'attendance.csv'),
          '--policy',str(f/'review_policy.json'),'--reference',str(f/'reference.json')]
    old=sys.argv
    try:
        sys.argv=args
        assert main()==0
        output=json.loads(capsys.readouterr().out)
    finally:
        sys.argv=old
    assert output['status']=='ORACLE_REVERSIBLE'
    assert output['minimum_changed_assignments']==1
    assert output['solver_status']=='NOT_RUN_T05'


def test_100_seeded_cases_vs_separate_cartesian_truth():
    # Independent test enumerator deliberately uses itertools.product, not oracle recursion.
    # Every baseline is full and valid; candidate collisions and unmatched are varied.
    for seed in range(100):
        rng=random.Random(seed)
        n=rng.randint(1,5)
        groups={f'R-{i}':rng.choice(['A','B']) for i in range(2*n)}
        reg_bytes=('registration_id,name,group\n'+''.join(f'{key},Name{i},{g}\n' for i,(key,g) in enumerate(groups.items()))).encode()
        att_bytes=('attendance_id,recorded_name\n'+''.join(f'T-{i},Person {i}\n' for i in range(n))).encode()
        regs,reg_d=load_csv_bytes(reg_bytes,'registrations')
        ats,att_d=load_csv_bytes(att_bytes,'attendance')
        bundle=InputBundle(registrations=regs,attendance=ats,registrations_digest=reg_d,attendance_digest=att_d)
        edges=[];raw_options=[]
        for i in range(n):
            permitted=[f'R-{i}']
            if rng.choice([False,True]): permitted.append(f'R-{i+n}')
            if n>1 and rng.choice([False,True]):permitted.append(f'R-{(i+1)%n}')
            permitted=list(dict.fromkeys(permitted))
            edges.extend(ReviewedEdge(attendance_id=f'T-{i}',registration_id=reg,status='POSSIBLE') for reg in permitted)
            raw_options.append(permitted+[None])
        d=ReviewDraft(revision=1,edges=tuple(edges), unmatched=tuple(UnmatchedRule(attendance_id=f'T-{i}',status='ALLOWED') for i in range(n)),
             coverage='REVIEWED_PARTIAL',scope_note='Seeded synthetic test restricted to these options.')
        snapshot=freeze_review(bundle,d)
        ref,_=freeze_reference(bundle,snapshot,ReferenceDraft(assignments=tuple({'attendance_id':f'T-{i}','registration_id':f'R-{i}'} for i in range(n))))
        result=enumerate_oracle(bundle,snapshot,ref)
        baseline=sum(groups[f'R-{i}']=='A' for i in range(n))>sum(groups[f'R-{i}']=='B' for i in range(n))
        best=None;count=0
        for choices in itertools.product(*raw_options):
            matched=[x for x in choices if x is not None]
            if len(matched)!=len(set(matched)):continue
            count+=1
            a=sum(groups[x]=='A' for x in matched)
            b=sum(groups[x]=='B' for x in matched)
            if (a>b)!=baseline:
                k=sum(x!=f'R-{i}' for i,x in enumerate(choices))
                best=k if best is None else min(best,k)
        assert result.enumerated_feasible_assignments==count,seed
        assert result.minimum_changed_assignments==best,seed
        assert result.status==('ORACLE_STABLE' if best is None else 'ORACLE_REVERSIBLE'),seed
